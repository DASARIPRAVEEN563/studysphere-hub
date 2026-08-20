import { useState } from "react";

/** What's new in the hub — tapping the card reveals the full changelog. */
const UPDATES: { date: string; title: string; points: string[] }[] = [
  {
    date: "Latest",
    title: "Folders, recovery bin and access control",
    points: [
      "Admin folders (Mid 1, Mid 2 …) inside every semester — view, download and like them.",
      "File viewer opens PDFs and images properly on mobile and desktop.",
      "Admins can clear chat messages and restore anything deleted for 10 days.",
      "Install the hub on your phone home screen as “SKNSH”.",
    ],
  },
  {
    date: "Earlier",
    title: "Faster hub and safer verification",
    points: [
      "Blink-based live face verification with an email confirmation code.",
      "Rename or delete the notes you shared, and add an optional note.",
      "Search notes by subject, department, year and semester with highlighting.",
      "Stars for every note you share, plus a top-3 leaderboard.",
    ],
  },
];

export function Updates() {
  const [open, setOpen] = useState(false);

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="text-2xl">🚀</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-black">Updates</span>
          <span className="text-muted-foreground block text-xs">
            Tap to see all the latest updates of the hub.
          </span>
        </span>
        <span className="text-muted-foreground text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {UPDATES.map((u) => (
            <article key={u.title} className="border-border rounded-2xl border p-4">
              <p className="text-cyan text-[11px] font-bold tracking-[0.2em] uppercase">{u.date}</p>
              <h4 className="mt-1 font-black">{u.title}</h4>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
                {u.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
