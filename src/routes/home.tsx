import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { BookLoader } from "@/components/BookLoader";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { ContentEffect } from "@/components/ContentEffect";
import { Logo3D } from "@/components/Logo3D";
import { api, type Feedback, type HubStats, type ContentItem } from "@/lib/api";


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
  { type: "advertisement", label: "Advertisements", accent: "from-pink to-cyan" },
] as const;

function HomePage() {
  return <HomeContent />;
}

function isEmbeddable(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com/.test(url);
}

function toEmbed(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url.replace("/view", "/preview");
}

/** Items published together share a base title with a " 01", " 02" suffix. */
function baseTitle(title: string) {
  return title.replace(/\s+\d{1,3}$/, "").trim();
}

function groupItems(list: ContentItem[]) {
  const groups: { key: string; title: string; items: ContentItem[] }[] = [];
  for (const item of list) {
    const key = baseTitle(item.title) || item.title;
    const found = groups.find((g) => g.key === key);
    if (found) found.items.push(item);
    else groups.push({ key, title: key, items: [item] });
  }
  return groups;
}

/** Saves any home-page media (data URL or remote file) to the device. */
async function saveMedia(url: string, title: string) {
  try {
    let href = url;
    if (!url.startsWith("data:")) {
      const blob = await fetch(url).then((r) => r.blob());
      href = URL.createObjectURL(blob);
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = title.replace(/[^\w.-]+/g, "_") || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (href !== url) URL.revokeObjectURL(href);
    toast.success("Download started");
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function HomeContent() {
  const user = useRequireAuth();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; title: string; video: boolean } | null>(
    null,
  );
  const [book, setBook] = useState<{ url: string; title?: string }[] | null>(null);

  useEffect(() => {
    api<{ content: ContentItem[] }>("/api/content")
      .then((r) => setItems(r.content))
      .catch(() => setItems([]));
  }, []);

  return (
    <AppShell title={user ? `Welcome, ${user.fullName}` : "Home"}>
      <section className="glass animate-rise mb-6 flex items-center gap-4 rounded-3xl p-5">
        <Logo3D size={64} className="animate-float" />
        <div className="min-w-0">
          <h2 className="gradient-text text-xl font-black">Students Ka Notes Sharing Hub</h2>
          <p className="text-muted-foreground text-xs">
            Notices, timetables, gallery and campus updates — all in one place.
          </p>
        </div>
      </section>
      {items === null ? (
        <BookLoader label="Loading updates" />
      ) : (
        <>
        {!items.length && (
          <div className="glass grid place-items-center rounded-3xl p-16 text-center">
            <p className="text-muted-foreground">
              No notices, timetables or gallery posts yet — the admin will publish them soon.
            </p>
          </div>
        )}
        {GROUPS.map((g) => {
          // Pinned items of every content type stay on top of their section.
          const list = items
            .filter((i) => i.type === g.type)
            .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
          if (!list.length) return null;
          return (
            <section key={g.type} className="mb-10">
              <h3 className="mb-4 text-lg font-bold">{g.label}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupItems(list).map((group) => {
                  const pages = group.items.filter((i) => i.url);
                  if (pages.length > 1) {
                    return (
                      <article
                        key={group.key}
                        className="glass animate-rise relative overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
                      >
                        <ContentEffect effect={group.items[0]?.effect} />
                        {group.items.some((i) => i.pinned) && (
                          <span className="bg-pink absolute top-3 left-3 z-10 rounded-full px-2 py-1 text-[10px] font-black text-white shadow-lg">
                            📌 PINNED
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setBook(pages.map((i) => ({ url: i.url!, title: i.title })))
                          }
                          aria-label={`Open ${group.title} gallery folder`}
                          className="bg-muted group relative block aspect-video w-full cursor-pointer overflow-hidden"
                        >
                          <img
                            src={pages[0]!.url}
                            alt={group.title}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-[11px] font-bold text-white">
                            <span>📁 {pages.length} images</span>
                            <span>Tap to flip →</span>
                          </span>
                        </button>
                        <div className="p-5">
                          <div
                            className={`mb-2 h-1 w-12 rounded-full bg-gradient-to-r ${g.accent}`}
                          />
                          <p className="font-bold">{group.title}</p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Gallery folder — turn one page at a time.
                          </p>
                        </div>
                      </article>
                    );
                  }
                  return group.items.map((item) => (
                  <article
                    key={item.id}
                    className="glass animate-rise relative overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
                  >
                    <ContentEffect effect={item.effect} />
                    {item.pinned && (
                      <span className="bg-pink absolute top-3 left-3 z-10 rounded-full px-2 py-1 text-[10px] font-black text-white shadow-lg">
                        📌 PINNED
                      </span>
                    )}
                    {item.badge && (
                      <span className="hero-gradient animate-badge absolute top-3 right-3 z-10 rounded-full px-3 py-1 text-[10px] font-black tracking-wider text-white shadow-lg">
                        {item.badge}
                      </span>
                    )}
                    {item.url && (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            url: item.url!,
                            title: item.title,
                            video: g.type === "video",
                          })
                        }
                        aria-label={`Open ${item.title}`}
                        className="bg-muted group relative block aspect-video w-full cursor-zoom-in overflow-hidden"
                      >
                        {g.type === "video" ? (
                          isEmbeddable(item.url) ? (
                            <iframe
                              src={toEmbed(item.url)}
                              title={item.title}
                              loading="lazy"
                              allowFullScreen
                              className="pointer-events-none size-full border-0"
                            />
                          ) : (
                            <video src={item.url} className="size-full object-cover" />
                          )
                        ) : (
                          <img
                            src={item.url}
                            alt={item.title}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
                          {g.type === "video" ? "▶ Play" : "🔍 View"}
                        </span>
                      </button>
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
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => void saveMedia(item.url!, item.title)}
                          className="glass mt-3 w-full rounded-xl px-3 py-2 text-xs font-bold transition-transform active:scale-95"
                        >
                          ⬇ Download
                        </button>
                      )}
                    </div>
                  </article>
                  ));
                })}
              </div>
            </section>
          );
        })}
        </>
      )}

      <HubCounters />
      <LatestReviews />

      {book && <FlipbookViewer pages={book} onClose={() => setBook(null)} />}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-rise w-full max-w-4xl overflow-hidden rounded-2xl"
          >
            {lightbox.video ? (
              isEmbeddable(lightbox.url) ? (
                <iframe
                  src={toEmbed(lightbox.url)}
                  title={lightbox.title}
                  allowFullScreen
                  className="aspect-video w-full border-0"
                />
              ) : (
                <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-full" />
              )
            ) : (
              <img
                src={lightbox.url}
                alt={lightbox.title}
                className="max-h-[80vh] w-full object-contain"
              />
            )}
            <div className="flex items-center justify-between gap-3 bg-black/70 px-4 py-3">
              <p className="text-sm font-bold text-white">{lightbox.title}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => void saveMedia(lightbox.url, lightbox.title)}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => setLightbox(null)}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Close ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/** Smoothly counts up to a number — used for the live hub counters. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (value <= 0) return setShown(0);
    const start = performance.now();
    const duration = 1200;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // Ease-out so the number slows down as it lands.
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown.toLocaleString()}</>;
}

/** Live totals for the whole hub — members, shares and downloads. */
function HubCounters() {
  const [stats, setStats] = useState<HubStats | null>(null);

  useEffect(() => {
    api<{ stats: HubStats }>("/api/stats")
      .then((r) => setStats(r.stats))
      .catch(() => setStats(null));
  }, []);

  const cards = [
    { label: "Members", icon: "\u{1F465}", value: stats?.users ?? 0, accent: "from-violet to-blue" },
    { label: "Notes shared", icon: "\u{1F4DA}", value: stats?.shares ?? 0, accent: "from-blue to-cyan" },
    { label: "Downloads", icon: "\u{2B07}\uFE0F", value: stats?.downloads ?? 0, accent: "from-cyan to-pink" },
    { label: "File views", icon: "\u{1F441}\uFE0F", value: stats?.views ?? 0, accent: "from-pink to-violet" },
  ];

  return (
    <section className="mt-8">
      <h3 className="mb-3 text-lg font-black">Our hub right now</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <article
            key={c.label}
            className="glass animate-rise rounded-3xl p-5 text-center"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className={`mx-auto mb-2 h-1 w-10 rounded-full bg-gradient-to-r ${c.accent}`} />
            <p className="text-2xl">{c.icon}</p>
            <p className="gradient-text mt-1 text-3xl font-black tabular-nums">
              <CountUp value={c.value} />
            </p>
            <p className="text-muted-foreground text-xs font-semibold">{c.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** The five most recent student reviews (reviews are collected at logout). */
function LatestReviews() {
  const [list, setList] = useState<Feedback[] | null>(null);

  useEffect(() => {
    api<{ feedback: Feedback[] }>("/api/feedback")
      .then((r) => setList(r.feedback ?? []))
      .catch(() => setList([]));
  }, []);

  if (list === null) return <BookLoader label="Loading reviews" />;
  if (!list.length) return null;

  return (
    <section className="mt-8">
      <h3 className="mb-3 text-lg font-black">What students say \u00b7 latest 5</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, 5).map((f, i) => (
          <article
            key={f.id}
            className="glass animate-rise rounded-2xl p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-bold">{f.userName}</p>
              <p className="shrink-0 text-sm">{"\u2B50".repeat(f.rating)}</p>
            </div>
            <p className="text-muted-foreground text-xs">{f.registrationId}</p>
            <p className="mt-2 text-sm">{f.comment}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
