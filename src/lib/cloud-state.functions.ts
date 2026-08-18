import { createServerFn } from "@tanstack/react-start";

/**
 * Cloud persistence for the whole app document.
 * Credentials (password / security answer) never leave the server: sign-up,
 * login and password recovery are handled here.
 */
export const cloudLoad = createServerFn({ method: "POST" }).handler(async () => {
  const { readDoc, writeDoc, sanitize } = await import("./cloud-state.server");
  const { seedDoc } = await import("./cloud-auth.server");
  const doc = await readDoc();
  const seeded = seedDoc(doc);
  if (seeded.changed) await writeDoc(seeded.doc);
  return { doc: sanitize(seeded.doc) };
});

export const cloudSave = createServerFn({ method: "POST" })
  .inputValidator((input: { doc: Record<string, any> }) => input)
  .handler(async ({ data }) => {
    const { readDoc, writeDoc, merge, sanitize } = await import("./cloud-state.server");
    const current = await readDoc();
    const next = merge(data.doc, current);
    await writeDoc(next);
    return { doc: sanitize(next) };
  });

export const cloudAuth = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string; body: Record<string, any> }) => input)
  .handler(async ({ data }) => {
    const { readDoc, writeDoc, sanitize } = await import("./cloud-state.server");
    const { handleAuth, seedDoc } = await import("./cloud-auth.server");
    const doc = seedDoc(await readDoc()).doc;
    // Expected credential problems are returned as data, never thrown: a thrown
    // server-function error surfaces as a runtime crash/blank screen.
    try {
      const result = handleAuth(data.path, data.body ?? {}, doc);
      if (result.persist) await writeDoc(doc);
      return { ...result.payload, doc: sanitize(doc) };
    } catch (err) {
      return { error: (err as Error).message || "Request failed", doc: sanitize(doc) };
    }
  });
