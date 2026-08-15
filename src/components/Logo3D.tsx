import { useRef, useState } from "react";

export const LOGO_SRC =
  "https://static.vecteezy.com/system/resources/thumbnails/054/043/179/small_2x/3d-icon-happy-student-man-icon-with-headphones-using-a-laptop-sitting-on-a-stack-of-books-online-education-studying-and-learning-with-a-transparent-background-png.png";

/** 3D student mascot that rotates and tilts as the cursor moves over it. */
export function Logo3D({
  size = 96,
  className = "",
  spin = false,
}: {
  size?: number;
  className?: string;
  spin?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

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
      className={`shrink-0 select-none ${className}`}
      style={{ width: size, height: size, perspective: `${size * 5}px` }}
    >
      <img
        src={LOGO_SRC}
        alt="Students Ka Notes Sharing Hub 3D mascot"
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
    </div>
  );
}
