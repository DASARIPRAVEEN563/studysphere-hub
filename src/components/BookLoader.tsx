export function BookLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16">
      <div className="relative h-28 w-56 [perspective:1100px]">
        {/* open book base: two flat pages */}
        <div className="glass absolute inset-0 rounded-2xl shadow-2xl" />
        <div className="absolute inset-y-3 left-3 right-1/2 mr-1 rounded-l-lg bg-muted/70 shadow-inner" />
        <div className="absolute inset-y-3 right-3 left-1/2 ml-1 rounded-r-lg bg-muted/70 shadow-inner" />
        {/* spine */}
        <div className="hero-gradient absolute inset-y-2 left-1/2 w-1.5 -translate-x-1/2 rounded-full opacity-80" />
        {/* turning sheets */}
        <div className="absolute inset-y-3 right-3 left-1/2 [transform-style:preserve-3d]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-page-flip absolute inset-0 origin-left rounded-r-lg border border-white/25 bg-card shadow-lg"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <div className="animate-page-shade absolute inset-0 rounded-r-lg bg-gradient-to-l from-black/40 via-black/5 to-transparent" />
              <div className="space-y-1.5 p-3">
                {[0, 1, 2, 3].map((l) => (
                  <div key={l} className="h-1 rounded-full bg-foreground/15" style={{ width: `${90 - l * 14}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="gradient-text mt-5 text-sm font-black tracking-[0.3em] uppercase">{label}</p>
    </div>
  );
}

export function BookLoaderOverlay({ label }: { label: string }) {
  return (
    <div className="bg-background/80 fixed inset-0 z-[60] grid place-items-center backdrop-blur-md">
      <BookLoader label={label} />
    </div>
  );
}