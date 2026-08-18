import { useEffect, useState } from "react";
import { ContentEffect } from "./ContentEffect";
import { api } from "@/lib/api";

type ContentLike = { effect?: string | null; createdAt?: string };

/** Reads the newest admin-picked effect so login/signup celebrations match the site theme. */
export function useWelcomeEffect(fallback = "newyear") {
  const [effect, setEffect] = useState(fallback);
  useEffect(() => {
    let alive = true;
    api<{ content: ContentLike[] }>("/api/content")
      .then((r) => {
        const withFx = (r.content ?? []).filter((c) => c.effect);
        const latest = withFx[withFx.length - 1];
        if (alive && latest?.effect) setEffect(latest.effect);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return effect;
}

/** Full-screen 3 second congratulations blast. */
export function Celebration({
  effect,
  message,
  duration = 3000,
  onDone,
}: {
  effect?: string;
  message?: string;
  duration?: number;
  onDone?: () => void;
}) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      <ContentEffect effect={effect || "newyear"} />
      {message && (
        <p className="gradient-text animate-rise absolute inset-x-0 top-1/3 text-center text-3xl font-black sm:text-5xl">
          {message}
        </p>
      )}
    </div>
  );
}