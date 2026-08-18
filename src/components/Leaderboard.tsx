import { useEffect, useMemo, useState } from "react";
import { api, type LeaderRow } from "@/lib/api";
import { inputClass } from "./Field";

/** Top sharers across the hub, ranked by total shares or total likes received. */
export function Leaderboard({ meId }: { meId?: string }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [mode, setMode] = useState<"likes" | "shares">("shares");

  useEffect(() => {
    api<{ leaders: LeaderRow[] }>("/api/leaderboard")
      .then((r) => setRows(r.leaders))
      .catch(() => setRows([]));
  }, []);

  const ranked = useMemo(
    () =>
      [...(rows ?? [])]
        .sort((a, b) => (mode === "likes" ? b.likes - a.likes : b.shares - a.shares))
        .filter((r) => r.shares > 0 || r.likes > 0)
        .slice(0, 3),
    [rows, mode],
  );

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black">🏆 Leaderboard — Top 3</h3>
        <select
          className={`${inputClass} w-auto`}
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          aria-label="Rank by"
        >
          <option value="shares" className="bg-card">Most shares</option>
          <option value="likes" className="bg-card">Most likes</option>
        </select>
      </div>
      <ol className="mt-4 space-y-2">
        {!ranked.length && (
          <p className="text-muted-foreground text-sm">No shared notes yet — be the first!</p>
        )}
        {ranked.map((r, i) => (
          <li
            key={r.id}
            className={`glass flex items-center gap-3 rounded-2xl p-3 ${
              r.id === meId ? "ring-primary ring-2" : ""
            }`}
          >
            <span className="hero-gradient grid size-8 shrink-0 place-items-center rounded-full text-xs font-black text-white">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{r.fullName}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {r.registrationId} · {r.department}
              </span>
            </span>
            <span className="shrink-0 text-sm font-black">
              {mode === "likes" ? `❤️ ${r.likes}` : `📤 ${r.shares}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
