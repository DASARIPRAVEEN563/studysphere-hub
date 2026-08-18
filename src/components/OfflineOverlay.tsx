import { useEffect, useRef, useState } from "react";
import { LOGO_SRC } from "./Logo3D";

/** Full-screen "you are offline" state with a tap-to-spin 3D globe-style mascot. */
export function OfflineOverlay() {
  const [offline, setOffline] = useState(false);
  const [angle, setAngle] = useState(0);
  const spinning = useRef(false);

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

  const spin = () => {
    if (spinning.current) return;
    spinning.current = true;
    setAngle((a) => a + 720);
    window.setTimeout(() => {
      spinning.current = false;
    }, 1200);
  };

  return (
    <div className="bg-background/95 fixed inset-0 z-[200] grid place-items-center px-6 text-center backdrop-blur-xl">
      <div>
        <button
          type="button"
          onClick={spin}
          aria-label="Spin the mascot"
          className="mx-auto block"
          style={{ perspective: "800px" }}
        >
          <img
            src={LOGO_SRC}
            alt="Offline mascot"
            draggable={false}
            className="size-40 object-contain sm:size-48"
            style={{
              transform: `rotateY(${angle}deg)`,
              transformStyle: "preserve-3d",
              transition: "transform 1.2s cubic-bezier(.2,.8,.2,1)",
              filter: "drop-shadow(0 18px 30px rgba(0,0,0,.45))",
            }}
          />
        </button>
        <h2 className="gradient-text mt-6 text-3xl font-black">You are offline</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Tap the mascot to spin it while we wait for your connection to come back.
        </p>
      </div>
    </div>
  );
}
