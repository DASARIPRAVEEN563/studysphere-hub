import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { btnClass, Field, ghostBtnClass, inputClass, Skeletons } from "@/components/Field";
import { CONTENT_EFFECTS, ContentEffect } from "@/components/ContentEffect";
import {
  api,
  DEPARTMENTS,
  downloadStudentsExcel,
  SEMESTERS,
  YEARS,
  type ChatThread,
  type ContentItem,
  type Feedback,
  type Note,
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

const TABS = ["notes", "content", "chat", "feedback", "students"] as const;

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
              {t}
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
      {tab === "content" && <ContentAdmin />}
      {tab === "chat" && <ChatAdmin />}
      {tab === "feedback" && <FeedbackAdmin />}
      {tab === "students" && <StudentsAdmin isMaster={me?.registrationId === "PRAVEEN2207"} />}
    </AppShell>
  );
}

const SEEN_KEY = "sknsh_admin_chat_seen";

/** Polls student chat and notifies the admin about new incoming messages. */
function useUnreadChat(viewing: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let stop = false;
    let known = -1;
    const tick = async () => {
      try {
        const r = await api<{ threads: ChatThread[] }>("/api/admin/chat");
        const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
        const incoming = r.threads.flatMap((t) =>
          t.messages.filter((m) => m.from === "user" && new Date(m.createdAt).getTime() > seen),
        );
        if (stop) return;
        if (viewing) {
          localStorage.setItem(SEEN_KEY, String(Date.now()));
          setUnread(0);
          known = 0;
          return;
        }
        if (known >= 0 && incoming.length > known) {
          toast.message(`New chat message from ${incoming[incoming.length - 1]?.userId ? "a student" : "a student"}`, {
            description: incoming[incoming.length - 1]?.text.slice(0, 80),
          });
        }
        known = incoming.length;
        setUnread(incoming.length);
      } catch {
        /* offline */
      }
    };
    void tick();
    const timer = setInterval(tick, 8000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [viewing]);
  return unread;
}

function NotesAdmin() {
  const [notes, setNotes] = useState<Note[] | null>(null);
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {notes.map((n) => (
        <article key={n.id} className="glass animate-rise space-y-4 rounded-2xl p-6">
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
              <div className="flex gap-2">
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
      {!notes.length && <p className="text-muted-foreground">No notes uploaded yet.</p>}
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <form onSubmit={create} className="glass animate-rise space-y-4 rounded-3xl p-8">
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
        {items === null ? (
          <Skeletons count={4} />
        ) : (
          items.map((i) => (
            <div key={i.id} className="glass animate-rise flex flex-wrap items-center gap-3 rounded-2xl p-4">
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
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{i.title}</p>
                <p className="text-muted-foreground truncate text-xs">{i.description}</p>
              </div>
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
          ))
        )}
      </div>
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

  const load = () =>
    api<{ threads: ChatThread[] }>("/api/admin/chat")
      .then((r) => setThreads(r.threads))
      .catch((e) => {
        toast.error((e as Error).message);
        setThreads([]);
      });

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, []);

  const active = (threads ?? []).find((t) => t.userId === activeId) ?? null;

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !text.trim()) return;
    setBusy(true);
    try {
      await api(`/api/admin/chat/${active.userId}`, { body: { text } });
      setText("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
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
      <form onSubmit={broadcast} className="glass animate-rise space-y-3 rounded-3xl p-6">
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
        <div className="space-y-2">
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

        <div className="glass flex h-[60vh] flex-col rounded-3xl p-4">
          {!active ? (
            <p className="text-muted-foreground m-auto text-sm">
              Select a student to read and reply to their messages.
            </p>
          ) : (
            <>
              <div className="border-border border-b pb-3">
                <p className="font-black">{active.fullName}</p>
                <p className="text-muted-foreground text-xs">
                  {active.registrationId} · {active.department} · {active.year} · {active.semester}
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {!active.messages.length && (
                  <p className="text-muted-foreground text-center text-sm">No messages yet.</p>
                )}
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        m.from === "admin" ? "hero-gradient text-white" : "bg-muted"
                      }`}
                    >
                      <p>{m.text}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {m.from === "admin" ? "You" : active.fullName} ·{" "}
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={reply} className="border-border flex gap-2 border-t pt-3">
                <input
                  className={inputClass}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Reply to ${active.fullName}...`}
                />
                <button className={btnClass} disabled={busy}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentsAdminInner({ isMaster }: { isMaster: boolean }) {
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<User[] | null>(null);

  useEffect(() => {
    api<{ students: User[] }>("/api/admin/students")
      .then((r) => setStudents(r.students))
      .catch(() => setStudents([]));
  }, []);

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
  return (
    <div className="space-y-6">
    <div className="glass animate-rise max-w-xl rounded-3xl p-8">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <article key={s.id} className="glass animate-rise flex gap-4 rounded-2xl p-5">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
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
                {(s.role !== "admin" ||
                  (isMaster && s.registrationId !== "PRAVEEN2207")) && (
                  <button
                    onClick={() => removeStudent(s)}
                    className="text-destructive mt-2 text-xs font-bold hover:underline"
                  >
                    🗑 Delete {s.role === "admin" ? "admin" : "user"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
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
          <p className="text-muted-foreground mt-2 text-xs">
            {new Date(f.createdAt).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}