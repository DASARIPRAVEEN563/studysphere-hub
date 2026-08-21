import { useEffect, useState } from "react";
import { LOGO_SRC } from "./Logo3D";

/**
 * Slim offline banner. Everything already loaded stays usable (browsing notes,
 * profile, chat history); only uploads and downloads are blocked, which the
 * action buttons themselves explain.
 */
export function OfflineOverlay() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200] px-3 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <div className="glass mx-auto flex max-w-lg items-center gap-3 rounded-2xl px-3 py-2 shadow-lg">
        <img src={LOGO_SRC} alt="" className="size-8 shrink-0 object-contain" draggable={false} />
        <p className="text-xs font-semibold">
          You are offline — you can still browse.
          <span className="text-muted-foreground block font-normal">
            Uploading and downloading notes will work again once you reconnect.
          </span>
        </p>
      </div>
    </div>
  );
}
