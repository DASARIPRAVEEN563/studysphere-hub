import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { btnClass, Field, inputClass } from "@/components/Field";
import { api, auth, DEPARTMENTS, SEMESTERS, YEARS } from "@/lib/api";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Share Notes | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Upload PDFs and images to share subject notes with your department and semester.",
      },
      { property: "og:title", content: "Share Notes | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Upload subject notes for your classmates." },
    ],
  }),
  component: SharePage,
});

const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];

function SharePage() {
  const user = useRequireAuth();
  const [subject, setSubject] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [year, setYear] = useState<string>(YEARS[0]);
  const [semester, setSemester] = useState<string>(SEMESTERS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a file first");
    if (!ALLOWED.includes(file.type)) return toast.error("Only PDF, JPG, PNG or WEBP allowed");
    if (file.size > 25 * 1024 * 1024) return toast.error("File must be under 25 MB");
    const form = new FormData();
    form.append("subject", subject);
    form.append("department", department);
    form.append("year", year);
    form.append("semester", semester);
    form.append("file", file);
    setLoading(true);
    try {
      await api("/api/notes/upload", { form });
      const u = auth.user();
      if (u) auth.setUser({ ...u, sharedCount: u.sharedCount + 1 });
      toast.success("Note uploaded to Google Drive successfully!");
      setSubject("");
      setFile(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Share Notes">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="glass animate-rise space-y-5 rounded-3xl p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject Name">
              <input
                className={inputClass}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Data Structures"
                required
              />
            </Field>
            <Field label="Department">
              <select
                className={inputClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} className="bg-card">
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
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
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s} className="bg-card">
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="border-primary/40 hover:bg-primary/10 block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-2xl">📤</p>
            <p className="mt-2 font-bold">{file ? file.name : "Click to select a file"}</p>
            <p className="text-muted-foreground text-xs">PDF, JPG, JPEG, PNG, WEBP · max 25 MB</p>
          </label>
          <button className={`${btnClass} w-full`} disabled={loading}>
            {loading ? "Uploading..." : "Upload Note"}
          </button>
        </form>
        <aside className="glass animate-rise rounded-3xl p-8">
          <h3 className="text-lg font-black">Storage path</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Your file is saved on Google Drive under:
          </p>
          <pre className="bg-primary/10 text-cyan mt-3 overflow-x-auto rounded-xl p-4 text-xs">
{`STUDENTS KA NOTES SHARING HUB
└── ${department}
    └── ${year}
        └── ${semester}
            └── ${file?.name ?? "your-file.pdf"}`}
          </pre>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center">
            <div className="glass rounded-2xl p-4">
              <p className="gradient-text text-2xl font-black">{user?.sharedCount ?? 0}</p>
              <p className="text-muted-foreground text-xs">Shared</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="gradient-text text-2xl font-black">{user?.downloadedCount ?? 0}</p>
              <p className="text-muted-foreground text-xs">Downloaded</p>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}