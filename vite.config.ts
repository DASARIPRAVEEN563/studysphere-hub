// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

// The MCP plugin compares paths with "/" separators, which fails on Windows
// (backslash paths) during local Android/APK builds. Skip it there.
const isWindows = process.platform === "win32";

// Offline support: the generated service worker keeps the app shell and assets
// available with no connection, so the site and the APK still open and show the
// cached data. HTML navigations stay network-first so updates land instantly.
const pwa = VitePWA({
  registerType: "autoUpdate",
  injectRegister: null,
  filename: "sw.js",
  devOptions: { enabled: false },
  manifest: false,
  workbox: {
    globPatterns: ["**/*.{js,css,png,svg,webp,woff2}"],
    navigateFallback: "/",
    navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn/],
    runtimeCaching: [
      {
        urlPattern: ({ request }: any) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: { cacheName: "sknsh-pages", networkTimeoutSeconds: 5 },
      },
      {
        urlPattern: ({ request, sameOrigin }: any) =>
          sameOrigin && ["style", "script", "image", "font"].includes(request.destination),
        handler: "CacheFirst",
        options: {
          cacheName: "sknsh-assets",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
});

export default defineConfig({
  plugins: isWindows ? [pwa] : [mcpPlugin(), pwa],

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
