import { useState } from "react";

/**
 * Multi-image viewer that turns one page at a time, like a real book.
 * Tap the right half to go forward, the left half to go back.
 */
export function FlipbookViewer({
  pages,
  onClose,
}: {
  pages: { url: string; title?: string }[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const page = pages[index];
  if (!page) return null;

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= pages.length) return;
    setDir(delta > 0 ? "next" : "prev");
    setIndex(next);
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Flipbook viewer"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-xl text-white"
      >
        ✕
      </button>
      <div className="w-full max-w-3xl" style={{ perspective: "1600px" }}>
        <div
          key={index}
          className="glass overflow-hidden rounded-2xl"
          style={{
            transformOrigin: dir === "next" ? "left center" : "right center",
            animation: "page-flip 0.6s ease-out",
          }}
        >
          <img
            src={page.url}
            alt={page.title ?? `Page ${index + 1}`}
            className="aspect-video w-full bg-black object-contain"
          />
          {page.title && <p className="p-3 text-center text-sm font-bold">{page.title}</p>}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-white">
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            ◀ Turn back
          </button>
          <span className="text-sm font-semibold">
            Page {index + 1} / {pages.length}
          </span>
          <button
            onClick={() => go(1)}
            disabled={index === pages.length - 1}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Turn page ▶
          </button>
        </div>
      </div>
    </div>
  );
}
