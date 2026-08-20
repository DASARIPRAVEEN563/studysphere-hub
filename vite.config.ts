// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// TEMP: dev-only receiver used to import a brand asset from the browser.
const tmpAssetReceiver = {
  name: "tmp-asset-receiver",
  configureServer(server: any) {
    server.middlewares.use("/__tmp-save", async (req: any, res: any) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const fs = await import("node:fs");
      fs.writeFileSync("/tmp/logo-in.bin", Buffer.concat(chunks));
      res.end("ok");
    });
  },
};

export default defineConfig({
  plugins: [mcpPlugin(), tmpAssetReceiver],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
