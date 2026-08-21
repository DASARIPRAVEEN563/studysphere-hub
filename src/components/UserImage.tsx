import { useEffect, useState } from "react";
import { cloudFile } from "@/lib/cloud-state.functions";

const cache = new Map<string, string>();

/**
 * Profile photos larger than a few KB are stored outside the users record and
 * referenced as `ref:<id>` — this resolves that reference lazily so pages stay
 * light and fast.
 */
export function UserImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const ref = typeof src === "string" && src.startsWith("ref:") ? src.slice(4) : null;
  const [resolved, setResolved] = useState<string | null>(ref ? (cache.get(ref) ?? null) : null);

  useEffect(() => {
    if (!ref || cache.has(ref)) return;
    let alive = true;
    cloudFile({ data: { id: ref } })
      .then((res) => {
        const url = res?.dataUrl ?? null;
        if (url) cache.set(ref, url);
        if (alive) setResolved(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ref]);

  const url = ref ? resolved : (src ?? null);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
