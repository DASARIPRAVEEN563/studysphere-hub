/**
 * Server-only persistence for the app document.
 *
 * The document is stored as several rows in `app_state` (one per collection)
 * instead of a single blob, so concurrent users writing different parts of the
 * app do not overwrite each other. Writes are merged per entity id against the
 * snapshot the browser started from, so a login/upload/chat happening at the
 * same time as another user's action keeps both changes.
 *
 * RLS is on with no policies, so the table is only reachable through the
 * service-role client used here.
 */
const LEGACY_ID = "main";

export const SHARDS = [
  "users",
  "notes",
  "content",
  "files",
  "chats",
  "feedback",
  "notifications",
  "likes",
] as const;

type Shard = (typeof SHARDS)[number];
type AnyDoc = any;

const ARRAY_SHARDS: Shard[] = ["users", "notes", "content", "chats", "feedback", "notifications"];
/**
 * Uploaded file blobs are big, so they never travel with the document: the
 * browser gets the ids only and fetches one blob on demand.
 */
const FILES: Shard = "files";

const emptyShard = (s: Shard): AnyDoc => (ARRAY_SHARDS.includes(s) ? [] : {});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Ids (or object keys) per collection — what the browser must send back on save. */
export function idsOf(doc: AnyDoc): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of SHARDS) {
    if (s === FILES) continue;
    const v = doc?.[s];
    out[s] = Array.isArray(v)
      ? v.map((e: AnyDoc) => String(e?.id ?? ""))
      : Object.keys(v ?? {});
  }
  return out;
}

export async function readDoc(): Promise<AnyDoc> {
  const db = await admin();
  const { data, error } = await db.from("app_state").select("id, data");
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const doc: AnyDoc = {};
  for (const s of SHARDS) doc[s] = emptyShard(s);

  // One-time migration from the old single-blob row.
  const legacy = rows.find((r) => r.id === LEGACY_ID);
  if (legacy) {
    const blob = (legacy.data as AnyDoc) ?? {};
    for (const s of SHARDS) if (blob[s] !== undefined) doc[s] = blob[s];
    await writeShards(doc, {});
    await db.from("app_state").delete().eq("id", LEGACY_ID);
    return doc;
  }

  for (const row of rows) {
    if ((SHARDS as readonly string[]).includes(row.id)) doc[row.id] = row.data ?? doc[row.id];
  }
  return doc;
}

/** Upsert only the collections whose content actually changed. */
async function writeShards(doc: AnyDoc, previous: AnyDoc) {
  const db = await admin();
  const now = new Date().toISOString();
  const rows = SHARDS.filter(
    (s) =>
      s === FILES
        ? // Comparing megabytes of base64 on every save is the slow path — the
          // key set is enough to know whether the blob store changed.
          Object.keys(doc[s] ?? {}).join("|") !== Object.keys(previous?.[s] ?? {}).join("|")
        : JSON.stringify(doc[s] ?? emptyShard(s)) !== JSON.stringify(previous?.[s]),
  ).map((s) => ({ id: s, data: (doc[s] ?? emptyShard(s)) as any, updated_at: now }));
  if (!rows.length) return;
  const { error } = await db.from("app_state").upsert(rows);
  if (error) throw new Error(error.message);
}

export async function writeDoc(doc: AnyDoc, previous: AnyDoc = {}): Promise<void> {
  await writeShards(doc, previous);
}

/**
 * Three-way merge: entities the browser sends win, entities it never saw are
 * kept, and entities it saw but dropped are treated as deletions.
 */
export function mergeShards(
  incoming: AnyDoc,
  current: AnyDoc,
  baseIds: Record<string, string[]> = {},
): AnyDoc {
  const out: AnyDoc = { ...current };
  for (const s of SHARDS) {
    if (incoming?.[s] === undefined) continue;
    if (s === FILES) {
      // Additive: the browser only ever sends newly uploaded blobs.
      out[s] = { ...(current[s] ?? {}), ...(incoming[s] ?? {}) };
      continue;
    }
    const seen = new Set(baseIds[s] ?? []);
    if (ARRAY_SHARDS.includes(s)) {
      const list: AnyDoc[] = Array.isArray(incoming[s]) ? incoming[s] : [];
      const sent = new Set(list.map((e) => String(e?.id ?? "")));
      const others = (Array.isArray(current[s]) ? current[s] : []).filter(
        (e: AnyDoc) => !sent.has(String(e?.id ?? "")) && !seen.has(String(e?.id ?? "")),
      );
      out[s] = [...list, ...others];
    } else {
      const obj = { ...(current[s] ?? {}) } as Record<string, AnyDoc>;
      for (const key of Object.keys(obj)) if (seen.has(key)) delete obj[key];
      out[s] = { ...obj, ...(incoming[s] ?? {}) };
    }
  }
  const removed: string[] = Array.isArray(incoming?.filesRemove) ? incoming.filesRemove : [];
  if (removed.length) {
    const files = { ...(out[FILES] ?? {}) } as Record<string, AnyDoc>;
    for (const key of removed) delete files[key];
    out[FILES] = files;
  }
  return out;
}

/** What the browser receives: no credentials and no file blobs. */
export function sanitize(doc: AnyDoc): AnyDoc {
  const users = Array.isArray(doc.users) ? doc.users : [];
  return {
    ...doc,
    files: {},
    fileIds: Object.keys(doc.files ?? {}),
    users: users.map((u: AnyDoc) => {
      const { password: _p, securityAnswer: _a, resetCode: _r, resetAt: _t, ...rest } = u;
      return rest;
    }),
  };
}

/** One uploaded file, fetched only when a note is viewed or downloaded. */
export async function readFile(fileId: string): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db.from("app_state").select("data").eq("id", FILES).maybeSingle();
  if (error) throw new Error(error.message);
  const files = (data?.data as Record<string, string>) ?? {};
  return files[fileId] ?? null;
}

/** Merge a browser-sent doc back in, keeping credentials the browser never saw. */
export function merge(incoming: AnyDoc, current: AnyDoc, baseIds?: Record<string, string[]>): AnyDoc {
  const merged = mergeShards(incoming, current, baseIds);
  const byId = new Map<string, AnyDoc>(
    (Array.isArray(current.users) ? current.users : []).map((u: AnyDoc) => [u.id, u]),
  );
  const users = (Array.isArray(merged.users) ? merged.users : []).map((u: AnyDoc) => {
    const old = byId.get(u.id);
    return {
      ...u,
      password: u.password ?? old?.password ?? "",
      securityAnswer: u.securityAnswer ?? old?.securityAnswer ?? "",
      securityQuestion: u.securityQuestion ?? old?.securityQuestion ?? "",
    };
  });
  return { ...merged, users };
}
