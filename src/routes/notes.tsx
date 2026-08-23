import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireVerified } from "@/components/AppShell";
import { BookLoader } from "@/components/BookLoader";
import { ghostBtnClass, inputClass } from "@/components/Field";
import {
  api,
  auth,
  DEPARTMENTS,
  downloadNote,
  noteViewUrl,
  sharerName,
  SEMESTERS,
  YEARS,
  type Folder,
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
  const me = useRequireVerified();
  const { dept } = Route.useSearch();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(dept ?? null);
  const [year, setYear] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [q, setQ] = useState("");
  const [dDept, setDDept] = useState("");
  const [dYear, setDYear] = useState("");
  const [dSem, setDSem] = useState("");
  const [sort, setSort] = useState<"recent" | "likes" | "downloads" | "views">("recent");

  useEffect(() => {
    api<{ folders: Folder[] }>("/api/folders")
      .then((r) => setFolders(r.folders ?? []))
      .catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    api<{ notes: Note[] }>("/api/notes")
      .then((r) => setNotes(r.notes))
      .catch((e) => {
        toast.error((e as Error).message);
        setNotes([]);
      });
  }, []);

  const isAdmin = me?.role === "admin";
  const term = q.trim();

  /** Applies the "most liked / downloaded / viewed" dropdown to any list of files. */
  const applySort = useMemo(
    () => (list: Note[]) => {
      const arr = [...list];
      if (sort === "likes") arr.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
      else if (sort === "downloads") arr.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
      else if (sort === "views") arr.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      else arr.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      return arr;
    },
    [sort],
  );

  /** Live subject search: prefix matches first, then any-position matches. */
  const searchResults = useMemo(() => {
    if (!term) return [];
    const t = term.toLowerCase();
    const all = notes ?? [];
    const starts = all.filter((n) => n.subject.toLowerCase().startsWith(t));
    const rest = all.filter(
      (n) =>
        !n.subject.toLowerCase().startsWith(t) &&
        (n.subject.toLowerCase().includes(t) ||
          n.fileName.toLowerCase().includes(t) ||
          n.uploadedBy.toLowerCase().includes(t)),
    );
    return [...starts, ...rest];
  }, [notes, term]);

  const scoped = useMemo(
    () =>
      (notes ?? []).filter(
        (n) =>
          (!department || n.department === department) &&
          (!year || n.year === year) &&
          (!semester || n.semester === semester) &&
          // Files inside an admin folder only show up inside that folder.
          (folder ? n.folderId === folder.id : !n.folderId) &&
          (!subject || n.subject === subject),
      ),
    [notes, department, year, semester, subject, folder],
  );

  /** Admin folders published for the semester the student is browsing. */
  const semesterFolders = useMemo(
    () =>
      folders.filter(
        (f) => f.department === department && f.year === year && f.semester === semester,
      ),
    [folders, department, year, semester],
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
    { label: "Departments", onClick: () => { setDepartment(null); setYear(null); setSemester(null); setSubject(null); setFolder(null); } },
    department && { label: department, onClick: () => { setYear(null); setSemester(null); setSubject(null); setFolder(null); } },
    year && { label: year, onClick: () => { setSemester(null); setSubject(null); setFolder(null); } },
    semester && { label: semester, onClick: () => { setSubject(null); setFolder(null); } },
    folder && { label: `📁 ${folder.name}`, onClick: () => setSubject(null) },
    subject && { label: subject, onClick: () => {} },
  ].filter(Boolean) as { label: string; onClick: () => void }[];

  const download = async (note: Note) => {
    if (!ensureFaceVerified("download")) return;
    try {
      const res = await downloadNote(note);
      const u = auth.user();
      if (u)
        auth.setUser({
          ...u,
          downloadedCount: u.downloadedCount + 1,
          stars: res.stars || u.stars || 0,
        });
      if (res.earnedStar)
        toast.success("\u2B50 You earned a star!", {
          description: "Five downloads completed — keep using the hub.",
        });
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

  /**
   * Hands the file to the device: the browser / phone opens it with the default
   * app (PDF reader, photo viewer) instead of an in-app frame.
   */
  const view = async (note: Note) => {
    setOpening(note.id);
    // Opened before the await so mobile popup blockers keep it allowed.
    const win = window.open("", "_blank");
    try {
      const url = await noteViewUrl(note);
      if (win) win.location.href = url;
      else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotes((prev) =>
        (prev ?? []).map((n) => (n.id === note.id ? { ...n, views: (n.views ?? 0) + 1 } : n)),
      );
    } catch (e) {
      win?.close();
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  /** Owner tools — a student manages only the notes they shared. */
  const rename = async (note: Note) => {
    const next = window.prompt("New subject name for this note", note.subject);
    if (next === null) return;
    const subject = next.trim();
    if (!subject) return;
    try {
      const r = await api<{ note: Note }>(`/api/notes/${note.id}`, {
        method: "PUT",
        body: { subject },
      });
      setNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? { ...n, ...r.note } : n)));
      toast.success("Note renamed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (note: Note) => {
    if (!window.confirm(`Delete "${note.subject}" (${note.fileName})? This cannot be undone.`))
      return;
    try {
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== note.id));
      toast.success("Note deleted");
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

      <form
        className="glass animate-rise mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setDepartment(dDept || null);
          setYear(dDept && dYear ? dYear : null);
          setSemester(dDept && dYear && dSem ? dSem : null);
          setSubject(null);
        }}
      >
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by subject name (type 'n' for all n… subjects)"
          />
          <button
            type="submit"
            aria-label="Search"
            className="hero-gradient grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-lg transition-transform hover:scale-110"
          >
            🔍
          </button>
        </div>
        <select
          className={inputClass}
          value={dDept}
          onChange={(e) => {
            setDDept(e.target.value);
            setDYear("");
            setDSem("");
          }}
        >
          <option value="" className="bg-card">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d} className="bg-card">{d}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={dYear}
          disabled={!dDept}
          onChange={(e) => {
            setDYear(e.target.value);
            setDSem("");
          }}
        >
          <option value="" className="bg-card">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y} className="bg-card">{y}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={dSem}
          disabled={!dDept || !dYear}
          onChange={(e) => setDSem(e.target.value)}
        >
          <option value="" className="bg-card">All semesters</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s} className="bg-card">{s}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort files"
        >
          <option value="recent" className="bg-card">Newest first</option>
          <option value="likes" className="bg-card">Most liked</option>
          <option value="downloads" className="bg-card">Most downloaded</option>
          <option value="views" className="bg-card">Most viewed</option>
        </select>
      </form>

      {notes === null ? (
        <BookLoader label="Opening library" />
      ) : term ? (
        searchResults.length ? (
          <section>
            <h3 className="mb-4 text-lg font-bold">
              {searchResults.length} result(s) for “{term}”
            </h3>
            <FileGrid
              notes={applySort(searchResults)}
              onView={view}
              onDownload={download}
              onLike={like}
              meId={me?.id}
              isAdmin={isAdmin}

              onRename={rename}
              onDelete={remove}
              opening={opening}
              highlight={term}
            />
          </section>
        ) : (
          <Empty text={`No subject or file matches “${term}”.`} />
        )
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
      ) : folder ? (
        scoped.length ? (
          <FileGrid
            notes={applySort(scoped)}
            onView={view}
            onDownload={download}
            onLike={like}
            meId={me?.id}
          isAdmin={isAdmin}
            opening={opening}
          />
        ) : (
          <Empty text="The admin has not added any file to this folder yet." />
        )
      ) : !subject ? (
        <>
          {semesterFolders.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-lg font-bold">Admin folders</h3>
              <Grid
                items={semesterFolders.map((f) => ({
                  label: f.name,
                  sub: `${(notes ?? []).filter((n) => n.folderId === f.id).length} file(s) · added by admin`,
                }))}
                onPick={(name) =>
                  setFolder(semesterFolders.find((f) => f.name === name) ?? null)
                }
                icon="🗂️"
              />
            </section>
          )}
          {subjects.length ? (
            <Grid
              items={subjects.map((s) => ({
                label: s,
                sub: `${scoped.filter((n) => n.subject === s).length} file(s) · shared by ${Array.from(
                  new Set(scoped.filter((n) => n.subject === s).map((n) => n.uploadedBy)),
                )
                  .map((name) => sharerName(name, isAdmin))
                  .join(", ")}`,
              }))}
              onPick={setSubject}
              icon="📁"
            />
          ) : semesterFolders.length ? null : (
            <Empty text="No subjects uploaded here yet." />
          )}
        </>
      ) : scoped.length ? (
        <FileGrid
          notes={applySort(scoped)}
          onView={view}
          onDownload={download}
          onLike={like}
          meId={me?.id}
          isAdmin={isAdmin}
          onRename={rename}
          onDelete={remove}
          opening={opening}
        />
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
                      Shared by {sharerName(n.uploadedBy, isAdmin)} · {new Date(n.uploadedAt).toLocaleDateString()}
                    </p>
                    {n.note && (
                      <p className="text-muted-foreground truncate text-xs italic">( {n.note} )</p>
                    )}
                    <p className="text-muted-foreground text-[10px] font-black uppercase">
                      {fileFormat(n)}
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

function FileGrid({
  notes,
  onView,
  onDownload,
  onLike,
  meId,
  onRename,
  onDelete,
  opening,
  highlight,
  isAdmin,
  folders,
}: {
  notes: Note[];
  onView: (n: Note) => void;
  onDownload: (n: Note) => void;
  onLike: (n: Note) => void;
  meId?: string | undefined;
  onRename?: ((n: Note) => void) | undefined;
  onDelete?: ((n: Note) => void) | undefined;
  opening?: string | null | undefined;
  highlight?: string | undefined;
  isAdmin?: boolean | undefined;
  folders?: Folder[] | undefined;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n, i) => {
        const mine = !!meId && n.uploadedById === meId;
        return (
        <article
          key={n.id}
          className="glass animate-rise rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-2xl"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <p
            className={
              highlight
                ? "text-cyan text-xl leading-snug font-black break-words uppercase"
                : "text-cyan text-xs font-semibold uppercase"
            }
            title={n.subject}
          >
            <MatchText text={n.subject} term={highlight} />
          </p>
          <p className="mt-1 truncate font-bold" title={n.fileName}>
            {n.fileName}
          </p>
          {n.note && <p className="text-muted-foreground mt-0.5 text-xs italic">( {n.note} )</p>}
          <p className="text-muted-foreground mt-1 text-xs">
            {n.department} · {n.year} · {n.semester} · {(n.size / 1024).toFixed(0)} KB
          </p>
          <p className="mt-1 text-xs">
            <span className="bg-primary/20 text-cyan rounded-md px-2 py-0.5 text-[10px] font-black tracking-wide uppercase">
              {fileFormat(n)}
            </span>
          </p>
          <p className="text-pink mt-1 text-xs font-semibold">Shared by {sharerName(n.uploadedBy, isAdmin)}</p>
          {n.folderId && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              🗂️ Inside admin folder “
              {(folders ?? []).find((f) => f.id === n.folderId)?.name ?? "folder"}”
            </p>
          )}
          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
            <button
              onClick={() => onLike(n)}
              className={`transition-transform hover:scale-110 ${n.likedByMe ? "text-pink" : ""}`}
              title="Rate this file"
            >
              {n.likedByMe ? "❤️" : "🤍"} {n.likes ?? 0} rating(s)
            </button>
            <span>👁 {n.views ?? 0} views</span>
            <span>⬇ {n.downloads ?? 0} downloads</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onView(n)}
              className={`${ghostBtnClass} flex-1`}
              disabled={opening === n.id}
            >
              {opening === n.id ? "Opening..." : "View"}
            </button>
            <button onClick={() => onDownload(n)} className={`${ghostBtnClass} flex-1`}>
              Download
            </button>
          </div>
          {mine && (onRename || onDelete) && (
            <div className="mt-2 flex gap-2">
              {onRename && (
                <button onClick={() => onRename(n)} className={`${ghostBtnClass} flex-1 text-xs`}>
                  ✏️ Rename
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(n)}
                  className={`${ghostBtnClass} text-destructive flex-1 text-xs`}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          )}
        </article>
        );
      })}
    </div>
  );
}

/** PDF / PNG / JPEG label taken from the mime type, with the extension as backup. */
function fileFormat(n: Note) {
  const mime = (n.mimeType ?? "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("webp")) return "WEBP";
  const ext = (n.fileName.split(".").pop() ?? "").toUpperCase();
  return ext || "FILE";
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

/** Makes the searched words pop inside the subject name. */
function MatchText({ text, term }: { text: string; term?: string | undefined }) {
  const t = (term ?? "").trim();
  if (!t) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="hero-gradient rounded-md px-1.5 py-0.5 text-white">
        {text.slice(idx, idx + t.length)}
      </span>
      {text.slice(idx + t.length)}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="glass grid place-items-center rounded-3xl p-16 text-center">
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}