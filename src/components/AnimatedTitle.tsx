const TITLE = "STUDENTS KA NOTES SHARING HUB";

export function AnimatedTitle({ className = "" }: { className?: string }) {
  return (
    <h1 className={`font-black tracking-tight ${className}`}>
      {TITLE.split(" ").map((word, wi) => (
        <span key={`${word}-${wi}`} className="mr-[0.35em] inline-block whitespace-nowrap">
          {word.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="animate-letter gradient-text animate-shine inline-block"
              style={{ animationDelay: `${(wi * 4 + i) * 35}ms` }}
            >
              {ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export function PageName({ name }: { name: string }) {
  return (
    <div key={name} className="animate-rise">
      <p className="text-cyan text-xs font-semibold tracking-[0.4em] uppercase">
        Students Ka Notes Sharing Hub
      </p>
      <h2 className="gradient-text mt-1 text-3xl font-black sm:text-4xl">{name}</h2>
    </div>
  );
}