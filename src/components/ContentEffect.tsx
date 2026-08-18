/** Festive particle overlays that admins can attach to any home-page content card. */
export const CONTENT_EFFECTS = [
  { value: "", label: "No effect" },
  { value: "crackers", label: "🎆 Fire crackers" },
  { value: "birthday", label: "🎂 Birthday blast" },
  { value: "diwali", label: "🪔 Diwali sparkles" },
  { value: "holi", label: "🎨 Holi colours" },
  { value: "christmas", label: "❄️ Christmas snow" },
  { value: "newyear", label: "🎉 New year confetti" },
  { value: "hearts", label: "💖 Love hearts" },
  { value: "stars", label: "⭐ Twinkling stars" },
] as const;

export type ContentEffectValue = (typeof CONTENT_EFFECTS)[number]["value"];

const PRESETS: Record<
  string,
  { emojis: string[]; mode: "burst" | "fall" | "rise" | "twinkle"; count: number }
> = {
  crackers: { emojis: ["🎆", "🎇", "✨", "💥"], mode: "burst", count: 8 },
  birthday: { emojis: ["🎂", "🎈", "🎉", "🥳"], mode: "burst", count: 8 },
  diwali: { emojis: ["🪔", "✨", "🎇"], mode: "rise", count: 7 },
  holi: { emojis: ["🎨", "🌈", "💜", "💛"], mode: "burst", count: 8 },
  christmas: { emojis: ["❄️", "🎄", "⛄"], mode: "fall", count: 9 },
  newyear: { emojis: ["🎉", "🎊", "🥂"], mode: "fall", count: 9 },
  hearts: { emojis: ["💖", "💗", "💘"], mode: "rise", count: 7 },
  stars: { emojis: ["⭐", "🌟", "✨"], mode: "twinkle", count: 8 },
};

export function ContentEffect({ effect }: { effect?: string | undefined }) {
  const preset = effect ? PRESETS[effect] : undefined;
  if (!preset) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      style={{ contain: "strict" }}
    >
      {Array.from({ length: preset.count }).map((_, i) => {
        const left = (i * 97) % 100;
        const delay = (i % 7) * 0.32;
        const size = 12 + ((i * 13) % 16);
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${left}%`,
          fontSize: `${size}px`,
          animationDelay: `${delay}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-out",
        };
        if (preset.mode === "burst") {
          const angle = (i / preset.count) * Math.PI * 2;
          Object.assign(style, {
            left: "50%",
            top: "50%",
            ["--fx-x" as string]: `${Math.cos(angle) * 120}px`,
            ["--fx-y" as string]: `${Math.sin(angle) * 90}px`,
            animationName: "fx-burst",
            animationDuration: "2.4s",
          });
        } else if (preset.mode === "fall") {
          Object.assign(style, { top: 0, animationName: "fx-fall", animationDuration: "5s" });
        } else if (preset.mode === "rise") {
          Object.assign(style, { top: 0, animationName: "fx-rise", animationDuration: "4.2s" });
        } else {
          Object.assign(style, {
            top: `${(i * 37) % 90}%`,
            animationName: "fx-twinkle",
            animationDuration: "2s",
          });
        }
        return (
          <span key={i} style={style}>
            {preset.emojis[i % preset.emojis.length]}
          </span>
        );
      })}
    </div>
  );
}
