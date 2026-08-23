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
  "folders",
  "trash",
] as const;

type Shard = (typeof SHARDS)[number];
type AnyDoc = any;

const ARRAY_SHARDS: Shard[] = [
  "users",
  "notes",
  "content",
  "chats",
  "feedback",
  "notifications",
  "folders",
  "trash",
];
/**
 * Uploaded file blobs are big, so they never travel with the document and are
 * never kept in one row: each blob lives in its own `file:<id>` row. Reads skip
 * them entirely and an upload only writes the single new row, which is what
 * keeps sharing a note fast no matter how many files exist.
 */
const FILES: Shard = "files";
const FILE_PREFIX = "file:";
const DOC_SHARDS = SHARDS.filter((s) => s !== FILES);

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
  const { data, error } = await db
    .from("app_state")
    .select("id, data")
    .in("id", [...DOC_SHARDS, LEGACY_ID]);
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
    await writeFiles(doc[FILES]);
    doc[FILES] = {};
    await db.from("app_state").delete().eq("id", LEGACY_ID);
    return doc;
  }

  for (const row of rows) {
    if ((SHARDS as readonly string[]).includes(row.id)) doc[row.id] = row.data ?? doc[row.id];
  }
  return doc;
}

/**
 * Profile photos are base64 and used to be stored inline in the `users` row,
 * which grew to megabytes and made every read hit the database timeout.
 * Anything big is moved to its own row and replaced by a `ref:` marker.
 */
const INLINE_IMAGE_LIMIT = 20_000;

async function externalizeAvatars(doc: AnyDoc) {
  const users: AnyDoc[] = Array.isArray(doc?.users) ? doc.users : [];
  const blobs: Record<string, string> = {};
  doc.users = users.map((u) => {
    const pic = u?.profilePicture;
    if (typeof pic !== "string" || pic.length <= INLINE_IMAGE_LIMIT) return u;
    if (pic.startsWith("ref:")) return u;
    const key = `userpic:${u.id}`;
    blobs[key] = pic;
    return { ...u, profilePicture: `ref:${key}` };
  });
  await writeFiles(blobs);
}

/** Upsert only the collections whose content actually changed (blobs excluded). */
async function writeShards(doc: AnyDoc, previous: AnyDoc) {
  const db = await admin();
  await externalizeAvatars(doc);
  const now = new Date().toISOString();
  const rows = DOC_SHARDS.filter(
    (s) => JSON.stringify(doc[s] ?? emptyShard(s)) !== JSON.stringify(previous?.[s]),
  ).map((s) => ({ id: s, data: (doc[s] ?? emptyShard(s)) as any, updated_at: now }));
  if (!rows.length) return;
  const { error } = await db.from("app_state").upsert(rows);
  if (error) throw new Error(error.message);
}

/** One row per uploaded blob: an upload writes only its own row. */
async function writeFiles(files: Record<string, string> | undefined) {
  const entries = Object.entries(files ?? {});
  if (!entries.length) return;
  const db = await admin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("app_state")
    .upsert(entries.map(([key, value]) => ({ id: FILE_PREFIX + key, data: value as any, updated_at: now })));
  if (error) throw new Error(error.message);
}

async function deleteFiles(ids: string[] | undefined) {
  if (!ids?.length) return;
  const db = await admin();
  await db.from("app_state").delete().in("id", ids.map((i) => FILE_PREFIX + i));
}

export async function writeDoc(doc: AnyDoc, previous: AnyDoc = {}): Promise<void> {
  await writeShards(doc, previous);
  await writeFiles(doc[FILES]);
  await deleteFiles(doc.filesRemove);
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
      // Additive and write-only: the browser sends just the new blobs.
      out[s] = { ...(incoming[s] ?? {}) };
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
  out.filesRemove = removed;
  return out;
}

/** What the browser receives: no credentials and no file blobs. */
export function sanitize(doc: AnyDoc): AnyDoc {
  const users = Array.isArray(doc.users) ? doc.users : [];
  return {
    ...doc,
    files: {},
    filesRemove: [],
    fileIds: [],
    users: users.map((u: AnyDoc) => {
      const { password: _p, securityAnswer: _a, resetCode: _r, resetAt: _t, ...rest } = u;
      return rest;
    }),
  };
}

/**
 * One uploaded file, fetched only when a note is viewed or downloaded.
 *
 * The database can cancel a slow statement ("statement timeout") when it is
 * busy; that used to throw and blank the screen. Instead we retry briefly and
 * then return null so the caller can show a friendly message.
 */
async function fetchRow(id: string): Promise<unknown> {
  const db = await admin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("app_state")
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (!error) return data?.data ?? null;
    if (attempt === 2) return null;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}

/** True once the legacy single-blob file row is known to be gone/unusable. */
let legacyFilesMissing = false;

export async function readFile(fileId: string): Promise<string | null> {
  const direct = await fetchRow(FILE_PREFIX + fileId);
  if (typeof direct === "string") return direct;
  // Older uploads still live inside the single legacy blob row (very large,
  // so it is only consulted once per server instance).
  if (legacyFilesMissing) return null;
  const legacy = await fetchRow(FILES);
  if (!legacy || typeof legacy !== "object") {
    legacyFilesMissing = true;
    return null;
  }
  return (legacy as Record<string, string>)[fileId] ?? null;
}


/**
 * Verification codes live in their own row (`code:<kind>:<userId>`) and never
 * travel inside the synced document. Two students verifying at the same time
 * used to overwrite each other's code through the shared `users` collection,
 * which made a correct code look invalid — a private row per person makes that
 * impossible.
 */
const CODE_TTL_MS = 30 * 60 * 1000;
const codeRowId = (kind: string, userId: string) => `code:${kind}:${userId}`;

export async function putCode(kind: string, userId: string, code: string): Promise<void> {
  const db = await admin();
  const { error } = await db.from("app_state").upsert({
    id: codeRowId(kind, userId),
    data: { code, at: Date.now() } as any,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** True when the code matches an unexpired code for this person. */
export async function checkCode(kind: string, userId: string, code: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db
    .from("app_state")
    .select("data")
    .eq("id", codeRowId(kind, userId))
    .maybeSingle();
  const row = (data?.data as { code?: string; at?: number } | null) ?? null;
  if (!row?.code) return false;
  if (row.at && Date.now() - row.at > CODE_TTL_MS) return false;
  return String(row.code).trim() === String(code).trim();
}

export async function clearCode(kind: string, userId: string): Promise<void> {
  const db = await admin();
  await db.from("app_state").delete().eq("id", codeRowId(kind, userId));
}

/** Flip flags on one person without rewriting the whole users collection. */
export async function patchUser(userId: string, patch: Record<string, unknown>): Promise<AnyDoc | null> {
  const db = await admin();
  const { data } = await db.from("app_state").select("data").eq("id", "users").maybeSingle();
  const users: AnyDoc[] = Array.isArray(data?.data) ? (data!.data as AnyDoc[]) : [];
  let updated: AnyDoc | null = null;
  const next = users.map((u) => {
    if (String(u?.id) !== String(userId)) return u;
    updated = { ...u, ...patch };
    return updated;
  });
  if (!updated) return null;
  await db
    .from("app_state")
    .upsert({ id: "users", data: next as any, updated_at: new Date().toISOString() });
  return updated;
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
      // Never sent to the browser, so a save must not erase them: without this
      // one student's save wiped another student's pending reset code.
      resetCode: old?.resetCode ?? null,
      resetAt: old?.resetAt ?? null,
    };
  });
  return { ...merged, users };
}
