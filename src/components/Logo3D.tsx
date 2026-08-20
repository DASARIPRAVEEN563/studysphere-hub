import { useEffect, useRef, useState } from "react";

/** The original 3D student mascot logo — also used for favicon and mobile install. */
export const LOGO_SRC = "/logo-3d.png";

/** 3D brand logo that rotates and tilts as the cursor moves over it. */
export function Logo3D({
  size = 96,
  className = "",
  spin = false,
  credit = false,
}: {
  size?: number;
  className?: string;
  spin?: boolean;
  /** Shows the "created and ideology by Praveen" line while the cursor is on the logo. */
  credit?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [failed, setFailed] = useState(false);

  // If the mascot image is slow or blocked (weak mobile network), fall back fast.
  useEffect(() => {
    const t = setTimeout(() => {
      const img = ref.current?.querySelector("img");
      if (img && !(img as HTMLImageElement).naturalWidth) setFailed(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 45, y: px * 60 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setTilt({ x: 0, y: 0 });
      }}
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: size, height: size, perspective: `${size * 5}px` }}
    >
      {credit && hover && (
        <span className="glass animate-rise pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap shadow-xl">
          created and ideology by{" "}
          <span className="gradient-text animate-shine text-sm font-black">Praveen</span>
        </span>
      )}
      {failed ? (
        <span
          className="hero-gradient grid size-full place-items-center rounded-2xl font-black text-white"
          style={{ fontSize: size * 0.5 }}
          aria-label="Students Ka Notes Sharing Hub"
        >
          S
        </span>
      ) : (
      <img
        src={LOGO_SRC}
        alt=""
        onError={() => setFailed(true)}
        decoding="async"
        draggable={false}
        className={spin ? "animate-logo-spin size-full object-contain" : "size-full object-contain"}
        style={{
          transform: spin
            ? undefined
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hover ? 1.12 : 1})`,
          transformStyle: "preserve-3d",
          transition: hover ? "transform 80ms linear" : "transform 500ms cubic-bezier(.2,.8,.2,1)",
          filter: "drop-shadow(0 12px 22px rgba(0,0,0,.35))",
        }}
      />
      )}
    </div>
  );
}
