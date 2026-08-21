import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Native-only glue for the Android APK build (Capacitor).
 * Everything is dynamically imported and guarded, so the web app is untouched:
 * in a normal browser this component renders nothing and loads nothing.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      // Dark status bar that matches the app background.
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0b1020" });
      } catch {
        /* status bar plugin unavailable */
      }

      // Hardware back button: go back in the app, exit only at the root.
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) router.history.back();
        else void App.exitApp();
      });
      if (cancelled) void handle.remove();
      else cleanup = () => void handle.remove();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
