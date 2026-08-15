export function BookLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16">
      <div className="relative h-24 w-40 [perspective:900px]">
        <div className="glass absolute inset-0 rounded-r-2xl rounded-l-md" />
        <div className="hero-gradient absolute inset-y-1 left-1 w-1.5 rounded-full" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-page-flip absolute inset-y-2 left-1/2 w-1/2 rounded-r-xl border border-white/20 bg-muted"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
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