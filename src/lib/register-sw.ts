/**
 * Single guarded registration point for the offline service worker.
 * It never registers in dev, inside the Lovable preview iframe, or when the
 * URL carries ?sw=off — in those cases any stale worker is removed instead.
 */
const SW_URL = "/sw.js";

function blocked() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev")
  );
}

async function unregisterOwn() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerOfflineWorker() {
  if (blocked()) {
    void unregisterOwn();
    return;
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(SW_URL).catch(() => {
      /* offline support is a bonus — never break the app for it */
    });
  });
}
