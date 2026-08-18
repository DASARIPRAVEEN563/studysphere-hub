import { useEffect, useState } from "react";
import { api, type AppNotification } from "@/lib/api";
import { ghostBtnClass } from "./Field";

/** Anonymous "someone liked your note" alerts for the signed-in student. */
export function LikeNotifications() {
  const [list, setList] = useState<AppNotification[]>([]);

  const load = () =>
    api<{ notifications: AppNotification[] }>("/api/notifications")
      .then((r) => setList(r.notifications ?? []))
      .catch(() => {});

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, []);

  const clear = async () => {
    await api("/api/notifications", { method: "POST", body: {} }).catch(() => {});
    void load();
  };

  if (!list.length) return null;
  const unread = list.filter((n) => !n.read).length;

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">
          🔔 Likes on your notes{unread ? ` · ${unread} new` : ""}
        </h3>
        <button onClick={() => void clear()} className={ghostBtnClass} type="button">
          Mark read
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {list.slice(0, 8).map((n) => (
          <li
            key={n.id}
            className={`glass rounded-2xl p-3 text-sm ${n.read ? "opacity-60" : "font-semibold"}`}
          >
            {n.text}
            <span className="text-muted-foreground block text-xs">
              {new Date(n.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
