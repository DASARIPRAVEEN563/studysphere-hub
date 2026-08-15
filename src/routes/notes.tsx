import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { BookLoader } from "@/components/BookLoader";
import { ghostBtnClass, inputClass } from "@/components/Field";
import {
  api,
  auth,
  DEPARTMENTS,
  downloadNote,
  SEMESTERS,
  viewNote,
  YEARS,
  type Note,
} from "@/lib/api";
import { ensureFaceVerified } from "@/lib/verify";

type Search = { dept?: string | undefined };

export const Route = createFileRoute("/notes")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    dept: typeof search["dept"] === "string" ? (search["dept"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notes Library | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content:
          "Browse notes by department, year, semester and subject, then download PDFs and images.",
      },
      { property: "og:title", content: "Notes Library | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Department → Year → Semester → Subject → Files." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  useRequireAuth();
  const { dept } = Route.useSearch();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [department, setDepartment] = useState<string | null>(dept ?? null);
  const [year, setYear] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [fDept, setFDept] = useState("");
  const [fYear, setFYear] = useState("");
  const [fSem, setFSem] = useState("");
  const [fSubject, setFSubject] = useState("");

  useEffect(() => {
    api<{ notes: Note[] }>("/api/notes")
      .then((r) => setNotes(r.notes))
      .catch((e) => {
        toast.error((e as Error).message);
        setNotes([]);
      });
  }, []);

  const scoped = useMemo(
    () =>
      (notes ?? []).filter(
        (n) =>
          (!department || n.department === department) &&
          (!year || n.year === year) &&
          (!semester || n.semester === semester) &&
          (!subject || n.subject === subject) &&
          (!fDept || n.department === fDept) &&
          (!fYear || n.year === fYear) &&
          (!fSem || n.semester === fSem) &&
          (!fSubject || n.subject.toLowerCase().includes(fSubject.toLowerCase())) &&
          (!term ||
            n.subject.toLowerCase().includes(term.toLowerCase()) ||
            n.fileName.toLowerCase().includes(term.toLowerCase()) ||
            n.uploadedBy.toLowerCase().includes(term.toLowerCase())),
      ),
    [notes, department, year, semester, subject, fDept, fYear, fSem, fSubject, term],
  );

  const subjects = useMemo(
    () => Array.from(new Set(scoped.map((n) => n.subject))).sort(),
    [scoped],
  );

  const recent = useMemo(
    () =>
      [...(notes ?? [])]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .slice(0, 10),
    [notes],
  );

  const crumbs = [
    { label: "Departments", onClick: () => { setDepartment(null); setYear(null); setSemester(null); setSubject(null); } },
    department && { label: department, onClick: () => { setYear(null); setSemester(null); setSubject(null); } },
    year && { label: year, onClick: () => { setSemester(null); setSubject(null); } },
    semester && { label: semester, onClick: () => setSubject(null) },
    subject && { label: subject, onClick: () => {} },
  ].filter(Boolean) as { label: string; onClick: () => void }[];

  const download = async (note: Note) => {
    if (!ensureFaceVerified("download")) return;
    try {
      await downloadNote(note);
      const u = auth.user();
      if (u) auth.setUser({ ...u, downloadedCount: u.downloadedCount + 1 });
      setNotes((prev) =>
        (prev ?? []).map((n) =>
          n.id === note.id ? { ...n, downloads: (n.downloads ?? 0) + 1 } : n,
        ),
      );
      toast.success(`Downloaded ${note.fileName}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const view = async (note: Note) => {
    try {
      await viewNote(note);
      setNotes((prev) =>
        (prev ?? []).map((n) => (n.id === note.id ? { ...n, views: (n.views ?? 0) + 1 } : n)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const like = async (note: Note) => {
    try {
      const r = await api<{ note: Note }>(`/api/notes/${note.id}/like`, { method: "POST" });
      setNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? { ...n, ...r.note } : n)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="Notes Library">
      <nav className="glass mb-6 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <button
              onClick={c.onClick}
              className={
                i === crumbs.length - 1
                  ? "gradient-text font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>

      <section className="glass animate-rise mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <form
          className="flex gap-2 sm:col-span-2 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(q.trim());
          }}
        >
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subject, file or student"
          />
          <button
            type="submit"
            aria-label="Search"
            className="hero-gradient grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-lg transition-transform hover:scale-110"
          >
            🔍
          </button>
        </form>
        <input
          className={inputClass}
          value={fSubject}
          onChange={(e) => setFSubject(e.target.value)}
          placeholder="Filter by subject name"
        />
        <select className={inputClass} value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option value="" className="bg-card">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d} className="bg-card">{d}</option>
          ))}
        </select>
        <select className={inputClass} value={fYear} onChange={(e) => setFYear(e.target.value)}>
          <option value="" className="bg-card">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y} className="bg-card">{y}</option>
          ))}
        </select>
        <select className={inputClass} value={fSem} onChange={(e) => setFSem(e.target.value)}>
          <option value="" className="bg-card">All semesters</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s} className="bg-card">{s}</option>
          ))}
        </select>
      </section>

      {notes === null ? (
        <BookLoader label="Opening library" />
      ) : !department ? (
        <Grid
          items={DEPARTMENTS.map((d) => ({ label: d, sub: "Department" }))}
          onPick={setDepartment}
          icon="🏛️"
        />
      ) : !year ? (
        <Grid items={YEARS.map((y) => ({ label: y, sub: department }))} onPick={setYear} icon="📅" />
      ) : !semester ? (
        <Grid
          items={SEMESTERS.map((s) => ({ label: s, sub: `${department} · ${year}` }))}
          onPick={setSemester}
          icon="📚"
        />
      ) : !subject ? (
        subjects.length ? (
          <Grid
            items={subjects.map((s) => ({
              label: s,
              sub: `${scoped.filter((n) => n.subject === s).length} file(s) · shared by ${Array.from(
                new Set(scoped.filter((n) => n.subject === s).map((n) => n.uploadedBy)),
              ).join(", ")}`,
            }))}
            onPick={setSubject}
            icon="📁"
          />
        ) : (
          <Empty text="No subjects uploaded here yet." />
        )
      ) : scoped.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scoped.map((n, i) => (
            <article
              key={n.id}
              className="glass animate-rise rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-2xl"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <p className="text-cyan text-xs font-semibold uppercase">{n.subject}</p>
              <p className="mt-1 truncate font-bold" title={n.fileName}>
                {n.fileName}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {(n.size / 1024).toFixed(0)} KB · {new Date(n.uploadedAt).toLocaleDateString()}
              </p>
              <p className="text-pink mt-1 text-xs font-semibold">Shared by {n.uploadedBy}</p>
              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                <button
                  onClick={() => like(n)}
                  className={`transition-transform hover:scale-110 ${n.likedByMe ? "text-pink" : ""}`}
                  title="Rate this file"
                >
                  {n.likedByMe ? "❤️" : "🤍"} {n.likes ?? 0} rating(s)
                </button>
                <span>👁 {n.views ?? 0} views</span>
                <span>⬇ {n.downloads ?? 0} downloads</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => view(n)} className={`${ghostBtnClass} flex-1`}>
                  View
                </button>
                <button onClick={() => download(n)} className={`${ghostBtnClass} flex-1`}>
                  Download
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="No files for this subject yet." />
      )}

      {notes !== null && (
        <section className="mt-12">
          <h3 className="mb-4 text-lg font-bold">Recently added notes · Top 10</h3>
          {recent.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((n, i) => (
                <article
                  key={n.id}
                  className="glass animate-rise flex items-center gap-3 rounded-2xl p-4"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="hero-gradient grid size-10 shrink-0 place-items-center rounded-xl">
                    📄
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{n.subject}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {n.department} · {n.year} · {n.semester}
                    </p>
                    <p className="text-cyan truncate text-xs">
                      Shared by {n.uploadedBy} · {new Date(n.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => view(n)} className={ghostBtnClass}>
                      View
                    </button>
                    <button onClick={() => download(n)} className={ghostBtnClass}>
                      Get
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No notes shared yet." />
          )}
        </section>
      )}
    </AppShell>
  );
}

function Grid({
  items,
  onPick,
  icon,
}: {
  items: { label: string; sub: string }[];
  onPick: (v: string) => void;
  icon: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it, i) => (
        <button
          key={it.label}
          onClick={() => onPick(it.label)}
          className="glass animate-rise group rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-2xl"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="hero-gradient mb-3 grid size-12 place-items-center rounded-2xl text-xl transition-transform group-hover:scale-110 group-hover:rotate-6">
            {icon}
          </div>
          <p className="text-lg font-black">{it.label}</p>
          <p className="text-muted-foreground text-xs">{it.sub}</p>
        </button>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="glass grid place-items-center rounded-3xl p-16 text-center">
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}