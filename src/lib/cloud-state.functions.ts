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
