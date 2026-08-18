import { useEffect } from "react";
import { Logo3D } from "./Logo3D";
import { Celebration, useWelcomeEffect } from "./Celebration";

/** Full-screen animated "Welcome <name>" splash shown after login / signup. */
export function WelcomeOverlay({
  name,
  subtitle,
  onDone,
  duration = 2200,
}: {
  name: string;
  subtitle?: string;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);

  const effect = useWelcomeEffect();

  return (
    <div className="bg-background/95 fixed inset-0 z-[100] grid place-items-center px-6 backdrop-blur-xl">
      <Celebration effect={effect} duration={3000} />
      <div className="text-center">
        <Logo3D size={110} className="animate-float mx-auto mb-8" />
        <p className="text-cyan animate-rise text-xs font-semibold tracking-[0.4em] uppercase">
          Students Ka Notes Sharing Hub
        </p>
        <h2 className="mt-3 text-4xl font-black sm:text-6xl">
          {`Welcome ${name}`.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="animate-letter gradient-text animate-shine inline-block"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground animate-rise mt-5 text-sm">{subtitle}</p>
        )}
        <div className="mx-auto mt-8 h-1 w-56 overflow-hidden rounded-full bg-muted">
          <div className="hero-gradient animate-shine h-full w-full" />
        </div>
      </div>
    </div>
  );
}
