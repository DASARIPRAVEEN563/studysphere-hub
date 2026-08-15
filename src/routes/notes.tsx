import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { ghostBtnClass, Skeletons } from "@/components/Field";
import {
  api,
  auth,
  DEPARTMENTS,
  downloadNote,
  SEMESTERS,
  YEARS,
  type Note,
} from "@/lib/api";

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
          (!subject || n.subject === subject),
      ),
    [notes, department, year, semester, subject],
  );

  const subjects = useMemo(
    () => Array.from(new Set(scoped.map((n) => n.subject))).sort(),
    [scoped],
  );

  const crumbs = [
    { label: "Departments", onClick: () => { setDepartment(null); setYear(null); setSemester(null); setSubject(null); } },
    department && { label: department, onClick: () => { setYear(null); setSemester(null); setSubject(null); } },
    year && { label: year, onClick: () => { setSemester(null); setSubject(null); } },
    semester && { label: semester, onClick: () => setSubject(null) },
    subject && { label: subject, onClick: () => {} },
  ].filter(Boolean) as { label: string; onClick: () => void }[];

  const download = async (note: Note) => {
    try {
      await downloadNote(note);
      const u = auth.user();
      if (u) auth.setUser({ ...u, downloadedCount: u.downloadedCount + 1 });
      toast.success(`Downloaded ${note.fileName}`);
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

      {notes === null ? (
        <Skeletons />
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
              sub: `${scoped.filter((n) => n.subject === s).length} file(s)`,
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
              <button onClick={() => download(n)} className={`${ghostBtnClass} mt-4 w-full`}>
                Download
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="No files for this subject yet." />
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