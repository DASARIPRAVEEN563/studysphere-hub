import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { btnClass, Field, ghostBtnClass, inputClass, Skeletons } from "@/components/Field";
import { CONTENT_EFFECTS, ContentEffect } from "@/components/ContentEffect";
import { SUPER_ADMIN_ID } from "@/lib/offline-backend";
import { sendAdminEmailBlast } from "@/lib/admin-email.functions";
import { usePoll } from "@/lib/use-poll";
import {
  api,
  DEPARTMENTS,
  downloadStudentsExcel,
  SEMESTERS,
  YEARS,
  ACCESS_AREAS,
  type AccessArea,
  type ChatThread,
  type ContentItem,
  type Feedback,
  type Folder,
  type Note,
  type TrashItem,
  type User,
} from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content:
          "Manage uploaded notes, rename subjects, move files, publish home content and export students.",
      },
      { property: "og:title", content: "Admin Portal | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Notes, content and student data management." },
    ],
  }),
  component: AdminPage,
});

const CONTENT_TYPES = [
  "gallery",
  "timetable",
  "promotion",
  "video",
  "notice",
  "advertisement",
] as const;

const TABS = [
  "notes",
  "folders",
  "content",
  "chat",
  "email",
  "feedback",
  "students",
  "access",
  "bin",
] as const;

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  notes: "Notes",
  folders: "Folders",
  content: "Content",
  chat: "Chat",
  email: "Email",
  feedback: "Feedback",
  students: "Students",
  access: "Access reject",
  bin: "Recently deleted",
};

const BADGES = ["", "NEW", "IMPORTANT", "URGENT", "HOT", "EVENT", "UPDATE"] as const;

function AdminPage() {
  const me = useRequireAuth("admin");
  const [tab, setTab] = useState<(typeof TABS)[number]>("notes");
  const unread = useUnreadChat(tab === "chat");

  return (
    <AppShell
      title="Admin Portal"
      actions={
        <div className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-bold capitalize transition-all ${
                tab === t ? "hero-gradient text-white shadow-lg" : "glass"
              }`}
            >
              {TAB_LABELS[t]}
              {t === "chat" && unread > 0 && (
                <span className="bg-destructive absolute -top-1 -right-1 grid min-w-5 animate-bounce place-items-center rounded-full px-1.5 text-[10px] font-black text-white">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>
      }
    >
      {tab === "notes" && <NotesAdmin />}
      {tab === "folders" && <FoldersAdmin />}
      {tab === "access" && <AccessAdmin />}
      {tab === "bin" && <TrashAdmin />}
      {tab === "content" && <ContentAdmin />}
      {tab === "chat" && <ChatAdmin />}
      {tab === "email" && <EmailAdmin />}
      {tab === "feedback" && <FeedbackAdmin />}
      {tab === "students" && <StudentsAdmin isMaster={me?.registrationId === SUPER_ADMIN_ID} />}
    </AppShell>
  );
}

const SEEN_KEY = "sknsh_admin_chat_seen";

/** Polls student chat and notifies the admin about new incoming messages. */
function useUnreadChat(viewing: boolean) {
  const [unread, setUnread] = useState(0);
  const knownRef = useRef(-1);
  const tick = async () => {
    try {
        const r = await api<{ threads: ChatThread[] }>("/api/admin/chat");
        const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
        const incoming = r.threads.flatMap((t) =>
          t.messages.filter((m) => m.from === "user" && new Date(m.createdAt).getTime() > seen),
        );
        if (viewing) {
          localStorage.setItem(SEEN_KEY, String(Date.now()));
          setUnread(0);
          knownRef.current = 0;
          return;
        }
        if (knownRef.current >= 0 && incoming.length > knownRef.current) {
          toast.message(`New chat message from ${incoming[incoming.length - 1]?.userId ? "a student" : "a student"}`, {
            description: incoming[incoming.length - 1]?.text.slice(0, 80),
          });
        }
        knownRef.current = incoming.length;
        setUnread(incoming.length);
    } catch {
      /* offline */
    }
  };
  usePoll(tick, 60000);
  return unread;
}

function NotesAdmin() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const load = () =>
    api<{ notes: Note[] }>("/api/admin/notes")
      .then((r) => setNotes(r.notes))
      .catch((e) => {
        toast.error((e as Error).message);
        setNotes([]);
      });
  useEffect(() => {
    void load();
  }, []);

  const patch = async (note: Note, body: Record<string, string>) => {
    try {
      await api(`/api/admin/notes/${note.id}`, { method: "PATCH", body });
      toast.success("Note updated");
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (note: Note) => {
    if (!confirm(`Delete ${note.fileName}?`)) return;
    try {
      await api(`/api/admin/notes/${note.id}`, { method: "DELETE" });
      toast.success("Note deleted");
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (notes === null) return <Skeletons count={6} />;

  // One folder per department so files are easy to find.
  const byDept = new Map<string, Note[]>();
  for (const n of notes) byDept.set(n.department, [...(byDept.get(n.department) ?? []), n]);
  const folders = [...byDept.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (!notes.length) return <p className="text-muted-foreground">No notes uploaded yet.</p>;

  if (!openDept)
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {folders.map(([dept, list], i) => (
          <button
            key={dept}
            onClick={() => setOpenDept(dept)}
            className="glass animate-rise rounded-2xl p-4 text-left transition-transform hover:-translate-y-1 sm:p-6"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="hero-gradient mb-3 grid size-12 place-items-center rounded-2xl text-xl">
              📂
            </div>
            <p className="text-lg font-black">{dept}</p>
            <p className="text-muted-foreground text-xs">{list.length} note(s)</p>
          </button>
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <button onClick={() => setOpenDept(null)} className={ghostBtnClass}>
        ← All departments
      </button>
      <h3 className="text-lg font-black">{openDept} notes</h3>
      <div className="grid gap-4 lg:grid-cols-2">
      {(byDept.get(openDept) ?? []).map((n) => (
        <article key={n.id} className="glass animate-rise space-y-4 rounded-2xl p-4 sm:p-6">
          <div>
            <p className="text-cyan text-xs font-bold uppercase">{n.subject}</p>
            <p className="truncate font-bold">{n.fileName}</p>
            <p className="text-muted-foreground text-xs">
              {n.department} · {n.year} · {n.semester} · {(n.size / 1024).toFixed(0)} KB · by{" "}
              {n.uploadedBy}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rename Subject">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  defaultValue={n.subject}
                  id={`subject-${n.id}`}
                  placeholder="New subject"
                />
                <button
                  className={ghostBtnClass}
                  onClick={() => {
                    const el = document.getElementById(`subject-${n.id}`) as HTMLInputElement;
                    void patch(n, { subject: el.value });
                  }}
                >
                  Save
                </button>
              </div>
            </Field>
            <Field label="Move to">
              <div className="grid grid-cols-3 gap-2">
                <select className={inputClass} id={`dept-${n.id}`} defaultValue={n.department}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} className="bg-card">
                      {d}
                    </option>
                  ))}
                </select>
                <select className={inputClass} id={`year-${n.id}`} defaultValue={n.year}>
                  {YEARS.map((y) => (
                    <option key={y} className="bg-card">
                      {y}
                    </option>
                  ))}
                </select>
                <select className={inputClass} id={`sem-${n.id}`} defaultValue={n.semester}>
                  {SEMESTERS.map((s) => (
                    <option key={s} className="bg-card">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className={btnClass}
              onClick={() => {
                const g = (p: string) =>
                  (document.getElementById(`${p}-${n.id}`) as HTMLSelectElement).value;
                void patch(n, { department: g("dept"), year: g("year"), semester: g("sem") });
              }}
            >
              Move
            </button>
            <button
              onClick={() => remove(n)}
              className="bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-xl px-4 py-2 text-sm font-bold transition-colors"
            >
              Delete
            </button>
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}

function ContentAdmin() {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([]);
  const [form, setForm] = useState({
    type: CONTENT_TYPES[0] as string,
    title: "",
    description: "",
    url: "",
    badge: "",
    effect: "",
  });

  const load = () =>
    api<{ content: ContentItem[] }>("/api/content")
      .then((r) => setItems(r.content))
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (uploads.length) {
        for (let i = 0; i < uploads.length; i++) {
          const u = uploads[i]!;
          await api("/api/admin/content", {
            body: {
              ...form,
              title: uploads.length > 1 ? `${form.title} ${String(i + 1).padStart(2, "0")}` : form.title,
              url: u.url,
            },
          });
        }
        toast.success(`${uploads.length} item(s) published`);
      } else {
        await api("/api/admin/content", { body: form });
        toast.success("Content published");
      }
      setForm({ ...form, title: "", description: "", url: "", badge: "", effect: "" });
      setUploads([]);
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const read = (file: File) =>
      new Promise<{ name: string; url: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, url: String(reader.result) });
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
      });
    try {
      const list = await Promise.all(Array.from(files).map(read));
      setUploads((prev) => [...prev, ...list]);
      toast.success(`${list.length} file(s) ready to publish`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/admin/content/${id}`, { method: "DELETE" });
      toast.success("Removed");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const rename = async (item: ContentItem) => {
    const title = prompt("New title", item.title);
    if (!title) return;
    try {
      await api(`/api/admin/content/${item.id}`, { method: "PATCH", body: { title } });
      toast.success("Updated");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  /** Pinned content stays on top of the home page until the admin unpins it. */
  const togglePin = async (item: ContentItem) => {
    try {
      await api(`/api/admin/content/${item.id}`, {
        method: "PATCH",
        body: { pinned: !item.pinned },
      });
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <form onSubmit={create} className="glass animate-rise space-y-4 rounded-3xl p-5 sm:p-8">
        <h3 className="text-lg font-black">Publish home content</h3>
        <Field label="Type">
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-card">
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Drop images / videos (multiple allowed)">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pickFiles(e.dataTransfer.files);
            }}
            className="border-border rounded-2xl border border-dashed p-4 text-center"
          >
            <p className="text-muted-foreground text-xs">Drag &amp; drop files here, or</p>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className={`${inputClass} mt-2`}
              onChange={(e) => void pickFiles(e.target.files)}
            />
            {uploads.length > 0 && (
              <p className="text-cyan mt-2 text-xs font-bold">
                {uploads.length} file(s) staged: {uploads.map((u) => u.name).join(", ")}
              </p>
            )}
          </div>
        </Field>
        <Field label="...or an Image / Video URL">
          <input
            className={inputClass}
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="Highlight badge (rotating)">
          <select
            className={inputClass}
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
          >
            {BADGES.map((b) => (
              <option key={b || "none"} value={b} className="bg-card">
                {b || "No badge"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Effect / animation">
          <select
            className={inputClass}
            value={form.effect}
            onChange={(e) => setForm({ ...form, effect: e.target.value })}
          >
            {CONTENT_EFFECTS.map((fx) => (
              <option key={fx.value || "none"} value={fx.value} className="bg-card">
                {fx.label}
              </option>
            ))}
          </select>
          {form.effect && (
            <div className="glass relative mt-3 h-28 overflow-hidden rounded-2xl">
              <ContentEffect effect={form.effect} />
              <p className="text-muted-foreground absolute inset-x-0 bottom-2 text-center text-[11px] font-bold">
                Live preview
              </p>
            </div>
          )}
        </Field>
        <p className="text-muted-foreground text-xs">
          All media is auto-fitted to a uniform 16:9 frame on the home page, so images and videos
          never look stretched.
        </p>
        <button className={`${btnClass} w-full`}>Publish</button>
      </form>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Pin works on every content type — notices, timetables, gallery, promotions, videos and
          advertisements. Pinned items stay on top of their section on the home page.
        </p>
        {items === null ? (
          <Skeletons count={4} />
        ) : (
          groupContent(items).map((group) =>
            group.items.length > 1 ? (
              <ContentGroupCard
                key={group.key}
                group={group}
                onRemove={remove}
                onRename={rename}
                onPin={togglePin}
              />
            ) : (
              group.items.map((i) => (
            <div key={i.id} className="glass animate-rise flex flex-wrap items-center gap-2 rounded-2xl p-3 sm:gap-3 sm:p-4">
              {i.url && (
                <img
                  src={i.url}
                  alt={i.title}
                  className="border-border h-12 w-20 shrink-0 rounded-lg border object-cover"
                />
              )}
              <span className="bg-primary/20 text-cyan rounded-full px-3 py-1 text-xs font-bold uppercase">
                {i.type}
              </span>
              {i.badge && (
                <span className="hero-gradient rounded-full px-2 py-0.5 text-[10px] font-black text-white">
                  {i.badge}
                </span>
              )}
              {i.pinned && (
                <span className="bg-pink/20 text-pink rounded-full px-2 py-0.5 text-[10px] font-black">
                  📌 PINNED
                </span>
              )}
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="truncate font-bold">{i.title}</p>
                <p className="text-muted-foreground truncate text-xs">{i.description}</p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <button onClick={() => togglePin(i)} className={ghostBtnClass}>
                  {i.pinned ? "📌 Unpin" : "📌 Pin"}
                </button>
                <button onClick={() => rename(i)} className={ghostBtnClass}>
                  Rename
                </button>
                <button
                  onClick={() => remove(i.id)}
                  className="text-destructive text-sm font-bold hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
              ))
            ),
          )
        )}
      </div>
    </div>
  );
}

type ContentGroup = { key: string; title: string; type: string; items: ContentItem[] };

/** Multi-upload batches share a title with a trailing " 01" counter — fold them into one folder. */
function groupContent(items: ContentItem[]): ContentGroup[] {
  const map = new Map<string, ContentGroup>();
  for (const item of items) {
    const base = item.title.replace(/\s+\d{2,}$/, "").trim() || item.title;
    const key = `${item.type}::${base.toLowerCase()}`;
    const group = map.get(key) ?? { key, title: base, type: item.type, items: [] };
    group.items.push(item);
    map.set(key, group);
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(a.items.some((i) => i.pinned) ? 0 : 1) - Number(b.items.some((i) => i.pinned) ? 0 : 1),
  );
}

function ContentGroupCard({
  group,
  onRemove,
  onRename,
  onPin,
}: {
  group: ContentGroup;
  onRemove: (id: string) => void;
  onRename: (item: ContentItem) => void;
  onPin: (item: ContentItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const pinned = group.items.some((i) => i.pinned);
  return (
    <div className="glass animate-rise space-y-3 rounded-2xl p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="text-2xl">📁</span>
        <div className="flex -space-x-3">
          {group.items.slice(0, 3).map(
            (i) =>
              i.url && (
                <img
                  key={i.id}
                  src={i.url}
                  alt={i.title}
                  className="border-border h-10 w-14 rounded-lg border object-cover"
                />
              ),
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{group.title}</p>
          <p className="text-muted-foreground text-xs">
            {group.type} · {group.items.length} items {pinned ? "· 📌 pinned" : ""}
          </p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲ Close" : "▼ Open"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border pt-3">
          {group.items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2">
              {i.url && (
                <img
                  src={i.url}
                  alt={i.title}
                  className="border-border h-10 w-16 shrink-0 rounded-lg border object-cover"
                />
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{i.title}</p>
              <button onClick={() => onPin(i)} className={ghostBtnClass}>
                {i.pinned ? "📌 Unpin" : "📌 Pin"}
              </button>
              <button onClick={() => onRename(i)} className={ghostBtnClass}>
                Rename
              </button>
              <button
                onClick={() => onRemove(i.id)}
                className="text-destructive text-sm font-bold hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentsAdmin({ isMaster }: { isMaster: boolean }) {
  return <StudentsAdminInner isMaster={isMaster} />;
}

function ChatAdmin() {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState(true);
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [requests, setRequests] = useState<User[]>([]);
  /** Message ids ticked for a bulk delete. */
  const [picked, setPicked] = useState<string[]>([]);

  /** Opening the chat board clears the unread badge straight away. */
  useEffect(() => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  }, []);

  const loadRequests = () =>
    api<{ students: User[] }>("/api/admin/students")
      .then((r) => setRequests(r.students.filter((s) => s.accessRequested && !s.faceVerified)))
      .catch(() => {});

  useEffect(() => {
    void loadRequests();
  }, []);

  const decideRequest = async (s: User, approve: boolean) => {
    try {
      await api(`/api/admin/students/${s.id}/verify`, { method: "POST", body: { approve } });
      toast.success(approve ? `${s.fullName} is verified` : "Request declined");
      await loadRequests();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  /** Removes one message, or the whole conversation, into "Recently deleted". */
  const removeMessage = async (messageId: string) => {
    try {
      await api(`/api/admin/chat/message/${messageId}`, { method: "DELETE" });
      setPicked((p) => p.filter((x) => x !== messageId));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  /** Deletes every ticked message in one go. */
  const removePicked = async () => {
    if (!picked.length) return;
    if (!confirm(`Delete ${picked.length} selected message(s)? You can restore them from the bin.`))
      return;
    try {
      await Promise.all(
        picked.map((id) => api(`/api/admin/chat/message/${id}`, { method: "DELETE" })),
      );
      setPicked([]);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const togglePicked = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const clearThread = async (userId: string, name: string) => {
    if (!confirm(`Delete the whole conversation with ${name}? You can restore it from the bin.`))
      return;
    try {
      await api(`/api/admin/chat/${userId}`, { method: "DELETE" });
      setActiveId(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const load = () =>
    api<{ threads: ChatThread[] }>("/api/admin/chat")
      .then((r) => setThreads(r.threads))
      .catch((e) => {
        toast.error((e as Error).message);
        setThreads([]);
      });

  usePoll(load, 30000);

  const active = (threads ?? []).find((t) => t.userId === activeId) ?? null;

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || (!text.trim() && !replyImage)) return;
    setBusy(true);
    try {
      await api(`/api/admin/chat/${active.userId}`, { body: { text, image: replyImage } });
      setText("");
      setReplyImage(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Downscales an attachment before it is sent to the student. */
  const pickReplyImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setReplyImage(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const broadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    const list = threads ?? [];
    if (!allUsers && !selected.length) {
      toast.error("Tick at least one student, or choose all students");
      return;
    }
    setBusy(true);
    try {
      if (allUsers) {
        const r = await api<{ sent: number }>("/api/admin/chat/broadcast", {
          body: { text: announcement },
        });
        toast.success(`Announcement sent to ${r.sent ?? list.length} students`);
      } else {
        await Promise.all(
          selected.map((uid) => api(`/api/admin/chat/${uid}`, { body: { text: announcement } })),
        );
        toast.success(`Announcement sent to ${selected.length} student(s)`);
      }
      setAnnouncement("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (threads === null) return <Skeletons count={4} />;

  const toggle = (uid: string) =>
    setSelected((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <section className="glass animate-rise space-y-3 rounded-3xl p-4 sm:p-6">
          <h3 className="text-lg font-black">
            🔔 Verification requests{" "}
            <span className="bg-destructive ml-1 rounded-full px-2 py-0.5 text-xs text-white">
              {requests.length}
            </span>
          </h3>
          {requests.map((s) => (
            <div
              key={s.id}
              className="border-border flex flex-wrap items-center gap-3 rounded-2xl border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{s.fullName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {s.registrationId} · {s.department} · {s.year} · {s.semester}
                  {s.email ? ` · ${s.email}` : ""}
                </p>
              </div>
              <button type="button" className={btnClass} onClick={() => void decideRequest(s, true)}>
                Approve
              </button>
              <button
                type="button"
                className={ghostBtnClass}
                onClick={() => void decideRequest(s, false)}
              >
                Decline
              </button>
            </div>
          ))}
        </section>
      )}
      <form onSubmit={broadcast} className="glass animate-rise space-y-3 rounded-3xl p-4 sm:p-6">
        <h3 className="text-lg font-black">📢 Announcement</h3>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={allUsers}
            onChange={(e) => setAllUsers(e.target.checked)}
          />
          Send to all students
        </label>
        {!allUsers && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
            {threads.map((t) => (
              <label key={t.userId} className="flex items-center gap-2 rounded-xl p-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={selected.includes(t.userId)}
                  onChange={() => toggle(t.userId)}
                />
                <span className="truncate">
                  {t.fullName} · <span className="text-muted-foreground">{t.registrationId}</span>
                </span>
              </label>
            ))}
            {!threads.length && <p className="text-muted-foreground text-sm">No students yet.</p>}
          </div>
        )}
        <textarea
          className={inputClass}
          rows={2}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Type an announcement — selected students receive it in their chat."
        />
        <button className={btnClass} disabled={busy}>
          {allUsers ? "Send to everyone" : `Send to ${selected.length} selected`}
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="max-h-64 space-y-2 overflow-y-auto lg:max-h-none lg:overflow-visible">
          {!threads.length && <p className="text-muted-foreground text-sm">No students yet.</p>}
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button
                key={t.userId}
                onClick={() => setActiveId(t.userId)}
                className={`glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all ${
                  activeId === t.userId ? "ring-primary ring-2" : ""
                }`}
              >
                <span className="hero-gradient grid size-10 shrink-0 place-items-center overflow-hidden rounded-full font-black text-white">
                  {t.profilePicture ? (
                    <img src={t.profilePicture} alt={t.fullName} className="size-full object-cover" />
                  ) : (
                    t.fullName.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{t.fullName}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {t.registrationId} · {t.department} · {t.year} · {t.semester}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {last ? last.text : "No messages yet"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="glass flex h-[65vh] flex-col rounded-3xl p-3 sm:p-4">
          {!active ? (
            <p className="text-muted-foreground m-auto text-sm">
              Select a student to read and reply to their messages.
            </p>
          ) : (
            <>
              <div className="border-border flex flex-wrap items-start gap-2 border-b pb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{active.fullName}</p>
                  <p className="text-muted-foreground text-xs">
                    {active.registrationId} · {active.department} · {active.year} · {active.semester}
                  </p>
                </div>
                {picked.length > 0 && (
                  <button
                    type="button"
                    className="bg-destructive rounded-xl px-4 py-2 text-sm font-black text-white shadow-lg"
                    onClick={() => void removePicked()}
                  >
                    🗑 Delete {picked.length} selected
                  </button>
                )}
                <button
                  type="button"
                  className="border-destructive text-destructive rounded-xl border-2 px-4 py-2 text-sm font-black"
                  onClick={() => void clearThread(active.userId, active.fullName)}
                >
                  🗑 Clear whole chat
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {!active.messages.length && (
                  <p className="text-muted-foreground text-center text-sm">No messages yet.</p>
                )}
                {active.messages.length > 0 && (
                  <p className="text-muted-foreground text-center text-[11px]">
                    Tick messages to delete only those ones.
                  </p>
                )}
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 ${m.from === "admin" ? "justify-end" : "justify-start"}`}
                  >
                    <input
                      type="checkbox"
                      aria-label="Select message"
                      className="size-5 shrink-0 accent-[var(--primary)]"
                      checked={picked.includes(m.id)}
                      onChange={() => togglePicked(m.id)}
                    />
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        m.from === "admin" ? "hero-gradient text-white" : "bg-muted"
                      }`}
                    >
                      {m.image && (
                        <img
                          src={m.image}
                          alt="Chat attachment"
                          className="mb-2 max-h-52 w-full rounded-xl object-cover"
                        />
                      )}
                      {m.text && <p>{m.text}</p>}
                      <p className="mt-1 text-[10px] opacity-70">
                        {m.from === "admin" ? "You" : active.fullName} ·{" "}
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete this message"
                      onClick={() => void removeMessage(m.id)}
                      className="bg-destructive grid size-9 shrink-0 place-items-center rounded-xl text-base text-white shadow"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={reply} className="border-border space-y-2 border-t pt-3">
                {replyImage && (
                  <div className="flex items-center gap-2">
                    <img src={replyImage} alt="Preview" className="size-12 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setReplyImage(null)}
                      className="text-xs font-semibold underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                <label className="glass grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl">
                  📎
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickReplyImage(e.target.files?.[0] ?? null)}
                  />
                </label>
                <input
                  className={`${inputClass} min-w-0 flex-1`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Reply to ${active.fullName}...`}
                />
                <button className={btnClass} disabled={busy}>
                  Send
                </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentsAdminInner({ isMaster }: { isMaster: boolean }) {
  return <StudentsAdminBody isMaster={isMaster} />;
}

/** Students waiting for a manual (in-person) verification by an admin. */
function VerificationRequests({
  list,
  onDecide,
}: {
  list: User[];
  onDecide: (s: User, approve: boolean) => void | Promise<void>;
}) {
  const pending = list.filter((s) => s.accessRequested);
  if (!pending.length) return null;
  return (
    <section className="glass animate-rise space-y-3 rounded-3xl p-5 sm:p-6">
      <h3 className="text-lg font-black">🙋 Verification requests ({pending.length})</h3>
      <p className="text-muted-foreground text-sm">
        These students could not finish camera or email verification. Verify them in person, then
        approve to unlock their account.
      </p>
      <ul className="space-y-2">
        {pending.map((s) => (
          <li
            key={s.id}
            className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-black">{s.fullName}</p>
              <p className="text-muted-foreground text-xs">
                {s.registrationId} · {s.department} · {s.year} · {s.semester}
                {s.email ? ` · ${s.email}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className={btnClass} onClick={() => void onDecide(s, true)} type="button">
                Approve
              </button>
              <button
                className={ghostBtnClass}
                onClick={() => void onDecide(s, false)}
                type="button"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Admin-side account creation: details are taken in person and pre-verified. */
function AddStudentForm({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(true);
  const [form, setForm] = useState({
    fullName: "",
    registrationId: "",
    email: "",
    password: "",
    department: DEPARTMENTS[0] as string,
    year: YEARS[0] as string,
    semester: SEMESTERS[0] as string,
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/create-student", {
        method: "POST",
        body: { ...form, registrationId: form.registrationId.toUpperCase(), verified },
      });
      toast.success(
        verified
          ? "Student added and verified — they can log in right away"
          : "Student added — they must finish verification themselves",
      );
      setForm({
        fullName: "",
        registrationId: "",
        email: "",
        password: "",
        department: DEPARTMENTS[0],
        year: YEARS[0],
        semester: SEMESTERS[0],
      });
      await onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass animate-rise rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">➕ Add a user</h3>
          <p className="text-muted-foreground text-sm">
            Create an account from the details you collect at the desk. Ticking the box counts as
            in-person face verification, so no camera or email code is needed.
          </p>
        </div>
        <button type="button" className={ghostBtnClass} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "New user"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full Name">
            <input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              required
            />
          </Field>
          <Field label="Registration ID (Hall Ticket No)">
            <input
              className={`${inputClass} uppercase`}
              value={form.registrationId}
              onChange={(e) => set("registrationId", e.target.value.toUpperCase())}
              required
            />
          </Field>
          <Field label="Email ID">
            <input
              className={inputClass}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="student@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              minLength={6}
              required
            />
          </Field>
          <Field label="Department">
            <select
              className={inputClass}
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-card">
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Year">
            <select
              className={inputClass}
              value={form.year}
              onChange={(e) => set("year", e.target.value)}
            >
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-card">
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select
              className={inputClass}
              value={form.semester}
              onChange={(e) => set("semester", e.target.value)}
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s} className="bg-card">
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end text-sm font-bold">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Face verified in person (skip code)
          </label>
          <div className="sm:col-span-2">
            <button className={btnClass} disabled={busy}>
              {busy ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function StudentsAdminBody({ isMaster }: { isMaster: boolean }) {
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<User[] | null>(null);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [openYear, setOpenYear] = useState<string | null>(null);
  // Manual shortlist filters (applied only when Search is pressed).
  const [fName, setFName] = useState("");
  const [fDept, setFDept] = useState("");
  const [fYear, setFYear] = useState("");
  const [applied, setApplied] = useState<{ name: string; dept: string; year: string } | null>(null);

  const loadStudents = () =>
    api<{ students: User[] }>("/api/admin/students")
      .then((r) => setStudents(r.students))
      .catch(() => setStudents([]));

  useEffect(() => {
    void loadStudents();
  }, []);

  /** Approve / reject a manual verification request raised by a student. */
  const decide = async (s: User, approve: boolean) => {
    try {
      const r = await api<{ user: User }>(`/api/admin/students/${s.id}/verify`, {
        method: "POST",
        body: { approve },
      });
      setStudents((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, ...r.user } : x)));
      toast.success(approve ? `${s.fullName} is verified` : "Request declined");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exportExcel = async () => {
    setBusy(true);
    try {
      await downloadStudentsExcel();
      toast.success("students.xlsx downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeStudent = async (s: User) => {
    const kind = s.role === "admin" ? "admin" : "student";
    if (!confirm(`Delete ${kind} ${s.fullName} (${s.registrationId})? This cannot be undone.`))
      return;
    try {
      await api(`/api/admin/students/${s.id}`, { method: "DELETE" });
      setStudents((prev) => (prev ?? []).filter((x) => x.id !== s.id));
      toast.success(`${kind === "admin" ? "Admin" : "Student"} deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Department folders → year folders → student cards.
  const list = students ?? [];
  const matches = applied
    ? list.filter(
        (s) =>
          (!applied.name ||
            s.fullName.toLowerCase().includes(applied.name.toLowerCase()) ||
            s.registrationId.toLowerCase().includes(applied.name.toLowerCase())) &&
          (!applied.dept || s.department === applied.dept) &&
          (!applied.year || s.year === applied.year),
      )
    : [];
  const deptNames = Array.from(new Set(list.map((s) => s.department || "Other"))).sort();
  const inDept = list.filter((s) => (s.department || "Other") === openDept);
  const yearNames = Array.from(new Set(inDept.map((s) => s.year || "Other"))).sort();
  const shown = inDept.filter((s) => (s.year || "Other") === openYear);

  return (
    <div className="space-y-6">
      <AddStudentForm onCreated={loadStudents} />
      <VerificationRequests list={students ?? []} onDecide={decide} />
    <div className="glass animate-rise max-w-xl rounded-3xl p-5 sm:p-8">
      <h3 className="text-lg font-black">Student data export</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Exports only full name, email ID, registration ID, department, year and semester. Passwords
        and security answers are never exported.
      </p>
      <button onClick={exportExcel} className={`${btnClass} mt-6`} disabled={busy}>
        {busy ? "Preparing..." : "Download students.xlsx"}
      </button>
    </div>

      {students === null ? (
        <Skeletons count={3} />
      ) : (
        <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ name: fName.trim(), dept: fDept, year: fYear });
        }}
        className="glass animate-rise grid gap-3 rounded-3xl p-5 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end sm:p-6"
      >
        <Field label="Name or hall ticket no">
          <input
            className={inputClass}
            value={fName}
            onChange={(e) => setFName(e.target.value)}
            placeholder="Search students"
          />
        </Field>
        <Field label="Department">
          <select className={inputClass} value={fDept} onChange={(e) => setFDept(e.target.value)}>
            <option value="" className="bg-card">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} className="bg-card">{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <select className={inputClass} value={fYear} onChange={(e) => setFYear(e.target.value)}>
            <option value="" className="bg-card">All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y} className="bg-card">{y}</option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <button className={btnClass} type="submit">🔍 Search</button>
          {applied && (
            <button
              type="button"
              className={ghostBtnClass}
              onClick={() => {
                setApplied(null);
                setFName("");
                setFDept("");
                setFYear("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {applied ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{matches.length} student(s) found</p>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {matches.map((s) => (
              <StudentCard key={s.id} s={s} isMaster={isMaster} onDelete={removeStudent} />
            ))}
          </div>
        </div>
      ) : !openDept ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {!deptNames.length && <p className="text-muted-foreground text-sm">No students yet.</p>}
          {deptNames.map((d) => (
            <button
              key={d}
              onClick={() => setOpenDept(d)}
              className="glass animate-rise rounded-2xl p-4 text-left transition-transform hover:-translate-y-1 sm:p-6"
            >
              <div className="hero-gradient mb-3 grid size-12 place-items-center rounded-2xl text-xl">
                🏛️
              </div>
              <p className="text-lg font-black">{d}</p>
              <p className="text-muted-foreground text-xs">
                {list.filter((s) => (s.department || "Other") === d).length} user(s)
              </p>
            </button>
          ))}
        </div>
      ) : !openYear ? (
        <div className="space-y-4">
          <button onClick={() => setOpenDept(null)} className={ghostBtnClass}>
            ← All departments
          </button>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {yearNames.map((y) => (
              <button
                key={y}
                onClick={() => setOpenYear(y)}
                className="glass animate-rise rounded-2xl p-4 text-left transition-transform hover:-translate-y-1 sm:p-6"
              >
                <div className="hero-gradient mb-3 grid size-12 place-items-center rounded-2xl text-xl">
                  📅
                </div>
                <p className="text-lg font-black">{y}</p>
                <p className="text-muted-foreground text-xs">
                  {inDept.filter((s) => (s.year || "Other") === y).length} user(s) · {openDept}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
        <button onClick={() => setOpenYear(null)} className={ghostBtnClass}>
          ← {openDept} years
        </button>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {shown.map((s) => (
            <StudentCard key={s.id} s={s} isMaster={isMaster} onDelete={removeStudent} />
          ))}
        </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function StudentCard({
  s,
  isMaster,
  onDelete,
}: {
  s: User;
  isMaster: boolean;
  onDelete: (s: User) => void;
}) {
  return (
    <article className="glass animate-rise flex gap-3 rounded-2xl p-4 sm:gap-4 sm:p-5">
      <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-xl">
        {s.faceImage ? (
          <img src={s.faceImage} alt={s.fullName} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground grid size-full place-items-center text-xs">
            No face
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold">{s.fullName}</p>
        <p className="text-muted-foreground text-xs">{s.registrationId}</p>
        <p className="text-cyan text-xs">
          {s.department} · {s.year} · {s.semester}
        </p>
        <p className="mt-1 text-xs">
          ⭐ {s.stars ?? 0} · {s.sharedCount} shared · {s.downloadedCount} downloaded ·{" "}
          {s.faceVerified ? "Verified" : "Unverified"}
        </p>
        {(s.role !== "admin" || (isMaster && s.registrationId !== SUPER_ADMIN_ID)) && (
          <button
            onClick={() => onDelete(s)}
            className="text-destructive mt-2 text-xs font-bold hover:underline"
          >
            🗑 Delete {s.role === "admin" ? "admin" : "user"}
          </button>
        )}
      </div>
    </article>
  );
}

function FeedbackAdmin() {
  const [list, setList] = useState<Feedback[] | null>(null);
  useEffect(() => {
    api<{ feedback: Feedback[] }>("/api/admin/feedback")
      .then((r) => setList(r.feedback))
      .catch(() => setList([]));
  }, []);
  if (list === null) return <Skeletons count={4} />;

  const remove = async (f: Feedback) => {
    if (!confirm(`Delete the feedback from ${f.userName}?`)) return;
    try {
      await api(`/api/admin/feedback/${f.id}`, { method: "DELETE" });
      setList((prev) => (prev ?? []).filter((x) => x.id !== f.id));
      toast.success("Feedback deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!list.length && <p className="text-muted-foreground text-sm">No feedback yet.</p>}
      {list.map((f) => (
        <article key={f.id} className="glass animate-rise rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="font-bold">{f.userName}</p>
            <p>{"⭐".repeat(f.rating)}</p>
          </div>
          <p className="text-muted-foreground text-xs">{f.registrationId}</p>
          <p className="mt-2 text-sm">{f.comment}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {new Date(f.createdAt).toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => remove(f)}
              className="text-pink text-xs font-bold hover:underline"
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
const DEFAULT_FROM = "STUDENTS KA NOTES SHARING HUB <studentsnotessharing@gmail.com>";

/** Festival / event mail blast: admin writes the message, picks recipients,
 * attaches images or files and can change the visible From address. */
function EmailAdmin() {
  const [students, setStudents] = useState<User[] | null>(null);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(true);
  const [files, setFiles] = useState<{ name: string; mime: string; dataUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ students: User[] }>("/api/admin/students")
      .then((r) => setStudents(r.students))
      .catch(() => setStudents([]));
  }, []);

  const withEmail = (students ?? []).filter((s) => (s.email ?? "").includes("@"));
  const scope = withEmail.filter(
    (s) => (!dept || s.department === dept) && (!year || s.year === year),
  );
  const recipients = all
    ? scope.map((s) => s.email!)
    : scope.filter((s) => picked[s.id]).map((s) => s.email!);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next = await Promise.all(
      Array.from(list)
        .slice(0, 5)
        .map(
          (f) =>
            new Promise<{ name: string; mime: string; dataUrl: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ name: f.name, mime: f.type || "application/octet-stream", dataUrl: String(reader.result) });
              reader.onerror = () => reject(new Error("Could not read the file"));
              reader.readAsDataURL(f);
            }),
        ),
    );
    setFiles((prev) => [...prev, ...next].slice(0, 5));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipients.length) {
      toast.error("No recipients with an email ID in this selection");
      return;
    }
    setBusy(true);
    try {
      const r = await sendAdminEmailBlast({
        data: { recipients, from: from.trim(), subject, message, attachments: files },
      });
      if (r.failed.length)
        toast.warning(`Sent to ${r.sent}, failed for ${r.failed.length} recipient(s)`);
      else toast.success(`Email sent to ${r.sent} student(s)`);
      setSubject("");
      setMessage("");
      setFiles([]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} className="glass animate-rise space-y-5 rounded-3xl p-5 sm:p-8">
      <div>
        <h3 className="text-lg font-black">Send an email to students</h3>
        <p className="text-muted-foreground text-sm">
          Festival greetings, event notices or announcements — with images and files attached.
        </p>
      </div>

      <Field label="From address (shown to students)">
        <input
          className={inputClass}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Name <mail@example.com>"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department">
          <select className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="" className="bg-card">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} className="bg-card">{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="" className="bg-card">All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y} className="bg-card">{y}</option>
            ))}
          </select>
        </Field>
      </div>

      <label className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Send to everyone in this selection ({scope.length})
      </label>

      {!all && (
        <div className="glass max-h-64 space-y-2 overflow-y-auto rounded-2xl p-3">
          {students === null && <Skeletons count={2} />}
          {scope.map((s) => (
            <label key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={!!picked[s.id]}
                onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
              />
              <span className="truncate font-semibold">{s.fullName}</span>
              <span className="text-muted-foreground truncate text-xs">{s.email}</span>
            </label>
          ))}
          {!scope.length && <p className="text-muted-foreground text-sm">No students with an email ID.</p>}
        </div>
      )}

      <Field label="Subject">
        <input
          className={inputClass}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Happy Diwali from Notes Hub"
          required
        />
      </Field>

      <Field label="Message">
        <textarea
          className={`${inputClass} min-h-40`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your special message here..."
          required
        />
      </Field>

      <Field label="Attach images or files (max 5)">
        <input type="file" multiple className={inputClass} onChange={(e) => void addFiles(e.target.files)} />
      </Field>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              📎 {f.name}
              <button
                type="button"
                className="text-destructive font-black"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className={btnClass} disabled={busy}>
        {busy ? "Sending..." : `Send to ${recipients.length} student(s)`}
      </button>
    </form>
  );
}

/** Admin-only folders (Mid 1, Mid 2 …). Students can browse, view, download and
 *  like the files inside, but only the admin can put files there. */
function FoldersAdmin() {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]!);
  const [year, setYear] = useState<string>(YEARS[0]!);
  const [semester, setSemester] = useState<string>(SEMESTERS[0]!);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const [f, n] = await Promise.all([
      api<{ folders: Folder[] }>("/api/admin/folders"),
      api<{ notes: Note[] }>("/api/admin/notes"),
    ]);
    setFolders(f.folders ?? []);
    setNotes(n.notes ?? []);
  };

  useEffect(() => {
    load().catch((e) => {
      toast.error((e as Error).message);
      setFolders([]);
    });
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/admin/folders", {
        method: "POST",
        body: { name: name.trim(), department, year, semester },
      });
      setName("");
      toast.success("Folder created");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (folder: Folder, body: Partial<Folder>) => {
    try {
      await api(`/api/admin/folders/${folder.id}`, { method: "PATCH", body });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (folder: Folder) => {
    if (!confirm(`Delete "${folder.name}"? Files inside move to Recently deleted.`)) return;
    try {
      await api(`/api/admin/folders/${folder.id}`, { method: "DELETE" });
      toast.success("Folder moved to Recently deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const upload = async (folder: Folder, file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("subject", file.name.replace(/\.[^.]+$/, ""));
      form.append("department", folder.department);
      form.append("year", folder.year);
      form.append("semester", folder.semester);
      form.append("folderId", folder.id);
      form.append("file", file);
      await api("/api/notes/upload", { form });
      toast.success("File added to the folder");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (note: Note) => {
    if (!confirm(`Delete "${note.subject}"? You can restore it from Recently deleted.`)) return;
    try {
      await api(`/api/admin/notes/${note.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (folders === null) return <Skeletons count={3} />;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="glass animate-rise space-y-3 rounded-3xl p-4 sm:p-6">
        <h3 className="text-lg font-black">🗂️ Create a folder</h3>
        <p className="text-muted-foreground text-xs">
          Only you can add files here — students can view, download and like them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Folder name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mid 1"
            />
          </Field>
          <Field label="Department">
            <select
              className={inputClass}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Year">
            <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select
              className={inputClass}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              {SEMESTERS.map((sm) => (
                <option key={sm}>{sm}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className={btnClass} disabled={busy}>
          Create folder
        </button>
      </form>

      {!folders.length && <p className="text-muted-foreground text-sm">No folders yet.</p>}

      {folders.map((f) => {
        const inside = notes.filter((n) => n.folderId === f.id);
        const open = openId === f.id;
        return (
          <section key={f.id} className="glass animate-rise space-y-3 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black">🗂️ {f.name}</p>
                <p className="text-muted-foreground text-xs">
                  {f.department} · {f.year} · {f.semester} · {inside.length} file(s)
                </p>
              </div>
              <button
                type="button"
                className={ghostBtnClass}
                onClick={() => setOpenId(open ? null : f.id)}
              >
                {open ? "Close" : "Manage"}
              </button>
            </div>

            {open && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Rename">
                    <input
                      className={inputClass}
                      defaultValue={f.name}
                      onBlur={(e) =>
                        e.target.value.trim() !== f.name &&
                        void patch(f, { name: e.target.value.trim() })
                      }
                    />
                  </Field>
                  <Field label="Move to department">
                    <select
                      className={inputClass}
                      value={f.department}
                      onChange={(e) => void patch(f, { department: e.target.value })}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Year">
                    <select
                      className={inputClass}
                      value={f.year}
                      onChange={(e) => void patch(f, { year: e.target.value })}
                    >
                      {YEARS.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Semester">
                    <select
                      className={inputClass}
                      value={f.semester}
                      onChange={(e) => void patch(f, { semester: e.target.value })}
                    >
                      {SEMESTERS.map((sm) => (
                        <option key={sm}>{sm}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <label className={`${btnClass} inline-flex cursor-pointer`}>
                  ⬆️ Add file
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => void upload(f, e.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="space-y-2">
                  {inside.map((n) => (
                    <div
                      key={n.id}
                      className="border-border flex flex-wrap items-center gap-3 rounded-2xl border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{n.subject}</p>
                        <p className="text-muted-foreground truncate text-xs">{n.fileName}</p>
                      </div>
                      <button
                        type="button"
                        className={ghostBtnClass}
                        onClick={() => void removeFile(n)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {!inside.length && (
                    <p className="text-muted-foreground text-sm">No files in this folder yet.</p>
                  )}
                </div>

                <button type="button" className={ghostBtnClass} onClick={() => void remove(f)}>
                  🗑 Delete folder
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const ACCESS_LABELS: Record<AccessArea, string> = {
  chat: "Chat with admin",
  share: "Share notes",
  feedback: "Feedback",
};

/** Reject a misbehaving student's access to chat, sharing or feedback. */
function AccessAdmin() {
  const [students, setStudents] = useState<User[] | null>(null);
  const [q, setQ] = useState("");

  const load = () =>
    api<{ students: User[] }>("/api/admin/students")
      .then((r) => setStudents(r.students))
      .catch((e) => {
        toast.error((e as Error).message);
        setStudents([]);
      });

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (s: User, area: AccessArea) => {
    const current = s.blocked ?? [];
    const next = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    try {
      await api(`/api/admin/students/${s.id}/access`, { method: "POST", body: { blocked: next } });
      toast.success(
        next.includes(area)
          ? `${ACCESS_LABELS[area]} blocked for ${s.fullName}`
          : `${ACCESS_LABELS[area]} restored for ${s.fullName}`,
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (students === null) return <Skeletons count={4} />;

  const term = q.trim().toLowerCase();
  const list = term
    ? students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(term) ||
          s.registrationId.toLowerCase().includes(term),
      )
    : students;

  return (
    <div className="space-y-4">
      <input
        className={inputClass}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Search a student by name or registration ID"
      />
      {list.map((s) => (
        <section key={s.id} className="glass animate-rise space-y-3 rounded-3xl p-4">
          <div>
            <p className="font-bold">{s.fullName}</p>
            <p className="text-muted-foreground text-xs">
              {s.registrationId} · {s.department} · {s.year} · {s.semester}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCESS_AREAS.map((area) => {
              const blocked = (s.blocked ?? []).includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => void toggle(s, area)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    blocked ? "bg-destructive text-white" : "glass"
                  }`}
                >
                  {blocked ? "🚫" : "✅"} {ACCESS_LABELS[area]}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!list.length && <p className="text-muted-foreground text-sm">No students found.</p>}
    </div>
  );
}

const TRASH_ICONS: Record<TrashItem["kind"], string> = {
  note: "📄",
  user: "👤",
  content: "🖼️",
  feedback: "⭐",
  chat: "💬",
  folder: "🗂️",
};

/** Recently deleted bin — everything is recoverable for 10 days. */
function TrashAdmin() {
  const [items, setItems] = useState<TrashItem[] | null>(null);

  const load = () =>
    api<{ trash: TrashItem[] }>("/api/admin/trash")
      .then((r) => setItems(r.trash ?? []))
      .catch((e) => {
        toast.error((e as Error).message);
        setItems([]);
      });

  useEffect(() => {
    void load();
  }, []);

  const restore = async (item: TrashItem) => {
    try {
      await api(`/api/admin/trash/${item.id}`, { method: "POST" });
      toast.success(`${item.label} restored`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const purge = async (item: TrashItem) => {
    if (!confirm(`Delete "${item.label}" for good? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/trash/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (items === null) return <Skeletons count={4} />;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Deleted notes, students, content, feedback, chats and folders stay here for 10 days, then
        they are removed automatically.
      </p>
      {!items.length && <p className="text-muted-foreground text-sm">The bin is empty.</p>}
      {items.map((t) => {
        const daysLeft = Math.max(
          0,
          10 - Math.floor((Date.now() - new Date(t.deletedAt).getTime()) / 86_400_000),
        );
        return (
          <section
            key={t.id}
            className="glass animate-rise flex flex-wrap items-center gap-3 rounded-3xl p-4"
          >
            <span className="text-2xl">{TRASH_ICONS[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{t.label}</p>
              <p className="text-muted-foreground truncate text-xs">
                {t.kind} · {t.detail} · deleted by {t.deletedBy} ·{" "}
                {new Date(t.deletedAt).toLocaleDateString()} · {daysLeft} day(s) left
              </p>
            </div>
            <button type="button" className={btnClass} onClick={() => void restore(t)}>
              Restore
            </button>
            <button type="button" className={ghostBtnClass} onClick={() => void purge(t)}>
              Delete forever
            </button>
          </section>
        );
      })}
    </div>
  );
}
