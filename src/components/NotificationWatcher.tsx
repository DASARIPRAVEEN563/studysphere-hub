import { useRef } from "react";
import {
  api,
  auth,
  safeStore,
  type AppNotification,
  type ContentItem,
  type Note,
} from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { pushNotify } from "@/lib/native-notify";

/**
 * Background watcher that turns hub activity into phone notifications:
 * new shared notes, likes on your notes and new admin content
 * (notices, gallery, promotions).
 */
const seenKey = (uid: string, kind: string) => `sknsh_notify_${kind}_${uid}`;

function readStamp(uid: string, kind: string) {
  try {
    return Number(localStorage.getItem(seenKey(uid, kind)) ?? 0);
  } catch {
    return 0;
  }
}

function writeStamp(uid: string, kind: string, value: number) {
  safeStore(seenKey(uid, kind), String(value));
}

function newest(items: { createdAt?: string }[]) {
  return items.reduce((max, i) => Math.max(max, new Date(i.createdAt ?? 0).getTime() || 0), 0);
}

export function NotificationWatcher() {
  const first = useRef(true);

  usePoll(
    async () => {
      const user = auth.user();
      if (!user || typeof navigator === "undefined" || navigator.onLine === false) return;

      const [notes, notifs, content] = await Promise.all([
        api<{ notes: Note[] }>("/api/notes").catch(() => ({ notes: [] as Note[] })),
        api<{ notifications: AppNotification[] }>("/api/notifications").catch(() => ({
          notifications: [] as AppNotification[],
        })),
        api<{ content: ContentItem[] }>("/api/content").catch(() => ({
          content: [] as ContentItem[],
        })),
      ]);

      // First pass after a fresh install only records where we are, so the
      // student is not flooded with a notification for every old item.
      const quiet = first.current && !readStamp(user.id, "notes");
      first.current = false;

      const fire = async (kind: string, items: { createdAt?: string }[], build: (n: number) => [string, string]) => {
        const last = readStamp(user.id, kind);
        const stamp = newest(items);
        if (!stamp) return;
        const fresh = items.filter((i) => (new Date(i.createdAt ?? 0).getTime() || 0) > last);
        writeStamp(user.id, kind, stamp);
        if (quiet || !last || !fresh.length) return;
        const [title, body] = build(fresh.length);
        await pushNotify(title, body);
      };

      const others = (notes.notes ?? [])
        .filter((n) => n.uploadedById !== user.id)
        .map((n) => ({ createdAt: n.uploadedAt }));
      await fire("notes", others, (n) => [
        "New notes shared 📚",
        n === 1 ? "A classmate just shared a new note." : `${n} new notes were shared.`,
      ]);

      await fire("likes", notifs.notifications ?? [], (n) => [
        "Someone liked your notes ❤️",
        n === 1 ? "Your shared note got a new like." : `${n} new likes on your notes.`,
      ]);

      await fire("content", content.content ?? [], (n) => [
        "New update from admin 📢",
        n === 1 ? "Admin posted new content." : `${n} new posts from admin.`,
      ]);
    },
    60000,
    true,
  );

  return null;
}
