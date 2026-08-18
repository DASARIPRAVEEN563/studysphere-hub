import { useEffect, useRef } from "react";

/**
 * Runs `fn` on an interval, but only while the tab is visible.
 * Background tabs stop fetching entirely, which keeps the app light on mobile.
 */
export function usePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = () => void saved.current();

    const start = () => {
      if (timer) return;
      run();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") run();
      }, ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisible = () => (document.visibilityState === "visible" ? start() : stop());

    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}
