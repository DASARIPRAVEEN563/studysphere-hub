import { useEffect } from "react";

export function StarReward({
  stars,
  onDone,
}: {
  stars: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="bg-background/80 fixed inset-0 z-[70] grid place-items-center backdrop-blur-xl">
      <div className="relative grid place-items-center">
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          return (
            <span
              key={i}
              className="animate-star-burst absolute text-2xl"
              style={
                {
                  "--sx": `${Math.cos(angle) * 150}px`,
                  "--sy": `${Math.sin(angle) * 150}px`,
                  animationDelay: `${i * 45}ms`,
                } as React.CSSProperties
              }
            >
              ⭐
            </span>
          );
        })}
        <div className="glass animate-star-pop relative rounded-3xl px-10 py-8 text-center">
          <p className="animate-star-pop text-6xl">⭐</p>
          <h3 className="gradient-text mt-3 text-2xl font-black">+1 Star earned!</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Thanks for sharing notes — you now have{" "}
            <span className="text-cyan font-bold">{stars}</span> star{stars === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
    </div>
  );
}