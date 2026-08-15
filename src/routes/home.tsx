import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { Skeletons } from "@/components/Field";
import { api, DEPARTMENTS, type ContentItem } from "@/lib/api";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content:
          "Your dashboard for department notices, timetables, gallery and quick access to notes.",
      },
      { property: "og:title", content: "Home | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Notices, timetables and quick note access." },
    ],
  }),
  component: HomePage,
});

const GROUPS = [
  { type: "notice", label: "Important Notices", accent: "from-pink to-violet" },
  { type: "timetable", label: "Timetables", accent: "from-blue to-cyan" },
  { type: "gallery", label: "Gallery", accent: "from-violet to-blue" },
  { type: "promotion", label: "Promotions", accent: "from-cyan to-pink" },
  { type: "video", label: "Videos", accent: "from-blue to-violet" },
] as const;

function HomePage() {
  const user = useRequireAuth();
  const [items, setItems] = useState<ContentItem[] | null>(null);

  useEffect(() => {
    api<{ content: ContentItem[] }>("/api/content")
      .then((r) => setItems(r.content))
      .catch(() => setItems([]));
  }, []);

  return (
    <AppShell title={user ? `Welcome, ${user.fullName}` : "Home"}>
      <section className="glass animate-rise mb-10 overflow-hidden rounded-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-cyan text-sm font-semibold">
              {user?.department} · {user?.year} · {user?.semester}
            </p>
            <h3 className="mt-2 max-w-lg text-3xl font-black">
              Everything your semester needs, in one <span className="gradient-text">hub</span>.
            </h3>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/notes"
                className="hero-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Browse Notes
              </Link>
              <Link
                to="/share"
                className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-white/10"
              >
                Share Notes
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Notes Shared" value={user?.sharedCount ?? 0} />
            <Stat label="Downloads" value={user?.downloadedCount ?? 0} />
          </div>
        </div>
      </section>

      <h3 className="mb-4 text-lg font-bold">Departments</h3>
      <div className="mb-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DEPARTMENTS.map((d, i) => (
          <Link
            key={d}
            to="/notes"
            search={{ dept: d }}
            className="glass animate-rise group rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-2xl"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="hero-gradient mb-3 grid size-10 place-items-center rounded-xl text-white transition-transform group-hover:scale-110">
              📁
            </div>
            <p className="font-bold">{d}</p>
            <p className="text-muted-foreground text-xs">Open folder</p>
          </Link>
        ))}
      </div>

      {items === null ? (
        <Skeletons />
      ) : (
        GROUPS.map((g) => {
          const list = items.filter((i) => i.type === g.type);
          if (!list.length) return null;
          return (
            <section key={g.type} className="mb-10">
              <h3 className="mb-4 text-lg font-bold">{g.label}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((item) => (
                  <article
                    key={item.id}
                    className="glass animate-rise overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
                  >
                    {item.url && (g.type === "gallery" || g.type === "promotion" || g.type === "timetable") && (
                      <img
                        src={item.url}
                        alt={item.title}
                        loading="lazy"
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="p-5">
                      <div className={`mb-2 h-1 w-12 rounded-full bg-gradient-to-r ${g.accent}`} />
                      <p className="font-bold">{item.title}</p>
                      {item.description && (
                        <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                      )}
                      {item.url && g.type === "video" && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan mt-2 inline-block text-sm hover:underline"
                        >
                          Watch video →
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass animate-float rounded-2xl px-6 py-4 text-center">
      <p className="gradient-text text-3xl font-black">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}