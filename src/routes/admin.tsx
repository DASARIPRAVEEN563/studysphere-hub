import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { btnClass, Field, ghostBtnClass, inputClass, Skeletons } from "@/components/Field";
import {
  api,
  DEPARTMENTS,
  downloadStudentsExcel,
  SEMESTERS,
  YEARS,
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

const TABS = ["notes", "content", "feedback", "students"] as const;

function AdminPage() {
  useRequireAuth("admin");
  const [tab, setTab] = useState<(typeof TABS)[number]>("notes");

  return (
    <AppShell
      title="Admin Portal"
      actions={
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-all ${
                tab === t ? "hero-gradient text-white shadow-lg" : "glass"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {tab === "notes" && <NotesAdmin />}
      {tab === "content" && <ContentAdmin />}
      {tab === "feedback" && <FeedbackAdmin />}
      {tab === "students" && <StudentsAdmin />}
    </AppShell>
  );
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
  const [form, setForm] = useState({
    type: CONTENT_TYPES[0] as string,
    title: "",
    description: "",
    url: "",
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
      await api("/api/admin/content", { body: form });
      toast.success("Content published");
      setForm({ ...form, title: "", description: "", url: "" });
      void load();
    } catch (err) {
      toast.error((err as Error).message);
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
        <Field label="Image / Video URL">
          <input
            className={inputClass}
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <button className={`${btnClass} w-full`}>Publish</button>
      </form>

      <div className="space-y-3">
        {items === null ? (
          <Skeletons count={4} />
        ) : (
          items.map((i) => (
            <div key={i.id} className="glass animate-rise flex items-center gap-4 rounded-2xl p-4">
              <span className="bg-primary/20 text-cyan rounded-full px-3 py-1 text-xs font-bold uppercase">
                {i.type}
              </span>
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

function StudentsAdmin() {
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
  return (
    <div className="space-y-6">
    <div className="glass animate-rise max-w-xl rounded-3xl p-8">
      <h3 className="text-lg font-black">Student data export</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Exports full name, registration ID, password hash, security question, security answer hash,
        department, year, semester, notes sharing count, downloaded notes count, stars and the live
        face-verification image of each verified student. Plaintext passwords are never exported.
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
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-black/30">
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