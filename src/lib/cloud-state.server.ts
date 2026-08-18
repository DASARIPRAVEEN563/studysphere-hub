/**
 * Server-only helpers that persist the whole app document in the cloud
 * database (table: app_state). The table has RLS on with no policies, so it is
 * only reachable through the service-role client used here.
 */
const ROW_ID = "main";

type AnyDoc = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readDoc(): Promise<AnyDoc> {
  const db = await admin();
  const { data, error } = await db.from("app_state").select("data").eq("id", ROW_ID).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.data as AnyDoc) ?? {}) as AnyDoc;
}

export async function writeDoc(doc: AnyDoc): Promise<void> {
  const db = await admin();
  const { error } = await db
    .from("app_state")
    .upsert({ id: ROW_ID, data: doc as any, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Users as sent to the browser: credentials stay on the server. */
export function sanitize(doc: AnyDoc): AnyDoc {
  const users = Array.isArray(doc.users) ? doc.users : [];
  return {
    ...doc,
    users: users.map((u: AnyDoc) => {
      const { password: _p, securityAnswer: _a, ...rest } = u;
      return rest;
    }),
  };
}

/** Merge a browser-sent doc back in, keeping credentials the browser never saw. */
export function merge(incoming: AnyDoc, current: AnyDoc): AnyDoc {
  const byId = new Map<string, AnyDoc>(
    (Array.isArray(current.users) ? current.users : []).map((u: AnyDoc) => [u.id, u]),
  );
  const users = (Array.isArray(incoming.users) ? incoming.users : []).map((u: AnyDoc) => {
    const old = byId.get(u.id);
    return {
      ...u,
      password: u.password ?? old?.password ?? "",
      securityAnswer: u.securityAnswer ?? old?.securityAnswer ?? "",
      securityQuestion: u.securityQuestion ?? old?.securityQuestion ?? "",
    };
  });
  return { ...incoming, users };
}
