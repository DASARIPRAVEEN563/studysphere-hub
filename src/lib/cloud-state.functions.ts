import { createServerFn } from "@tanstack/react-start";

/**
 * Cloud persistence for the app document.
 * Credentials (password / security answer) never leave the server: sign-up,
 * login and password recovery are handled here.
 */
export const cloudLoad = createServerFn({ method: "POST" }).handler(async () => {
  const { readDoc, writeDoc, sanitize, idsOf } = await import("./cloud-state.server");
  const { seedDoc } = await import("./cloud-auth.server");
  const loaded = await readDoc();
  const before = JSON.parse(JSON.stringify(loaded));
  const seeded = seedDoc(loaded);
  if (seeded.changed) await writeDoc(seeded.doc, before);
  return { doc: sanitize(seeded.doc), baseIds: idsOf(seeded.doc) };
});

export const cloudSave = createServerFn({ method: "POST" })
  .inputValidator((input: { doc: Record<string, any>; baseIds?: Record<string, string[]> }) => input)
  .handler(async ({ data }) => {
    const { readDoc, writeDoc, merge, sanitize, idsOf } = await import("./cloud-state.server");
    const current = await readDoc();
    const next = merge(data.doc, current, data.baseIds);
    await writeDoc(next, current);
    return { doc: sanitize(next), baseIds: idsOf(next) };
  });

export const cloudAuth = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string; body: Record<string, any> }) => input)
  .handler(async ({ data }) => {
    const { readDoc, writeDoc, sanitize, idsOf } = await import("./cloud-state.server");
    const { handleAuth, seedDoc } = await import("./cloud-auth.server");
    const loaded = await readDoc();
    const before = JSON.parse(JSON.stringify(loaded));
    const doc = seedDoc(loaded).doc;
    // Expected credential problems are returned as data, never thrown: a thrown
    // server-function error surfaces as a runtime crash/blank screen.
    try {
      const result = handleAuth(data.path, data.body ?? {}, doc);
      if (result.persist) await writeDoc(doc, before);
      return { ...result.payload, doc: sanitize(doc), baseIds: idsOf(doc) };
    } catch (err) {
      return { error: (err as Error).message || "Request failed", doc: sanitize(doc), baseIds: idsOf(doc) };
    }
  });

/** Fetch a single uploaded file blob (kept out of the synced document). */
export const cloudFile = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { readFile } = await import("./cloud-state.server");
    return { dataUrl: await readFile(String(data.id)) };
  });

/**
 * Issue / verify a one-time code (face verification today).
 * The code is stored in a private per-person row, so it can never be
 * overwritten by another student saving at the same time.
 */
export const cloudCode = createServerFn({ method: "POST" })
  .inputValidator((input: { action: "issue" | "verify"; kind: string; userId: string; code?: string }) => input)
  .handler(async ({ data }) => {
    const { putCode, checkCode, clearCode, patchUser } = await import("./cloud-state.server");
    const kind = String(data.kind || "face");
    const userId = String(data.userId || "");
    if (!userId) return { ok: false, error: "Please login again" };

    if (data.action === "issue") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await putCode(kind, userId, code);
      return { ok: true, code };
    }

    const entered = String(data.code ?? "").replace(/\D/g, "");
    if (!entered) return { ok: false, error: "Enter the code from your email" };
    const ok = await checkCode(kind, userId, entered);
    if (!ok) return { ok: false, error: "Incorrect or expired verification code" };
    await clearCode(kind, userId);
    const user = await patchUser(userId, { identityConfirmed: true, faceVerified: true });
    return { ok: true, user };
  });
