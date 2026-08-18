import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { BookLoader } from "@/components/BookLoader";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { ContentEffect } from "@/components/ContentEffect";
import { btnClass, inputClass } from "@/components/Field";
import { api, type ContentItem, type Feedback } from "@/lib/api";

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
          const list = items.filter((i) => i.type === g.type);
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

      <FeedbackSection />
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

function FeedbackSection() {
  const [list, setList] = useState<Feedback[] | null>(null);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ feedback: Feedback[] }>("/api/feedback")
      .then((r) => setList(r.feedback))
      .catch(() => setList([]));

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/feedback", { body: { rating, comment } });
      toast.success("Thanks for your feedback!");
      setComment("");
      setRating(5);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={submit} className="glass animate-rise space-y-4 rounded-3xl p-8">
        <h3 className="text-lg font-black">Rate this hub</h3>
        <div className="flex gap-1 text-3xl">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-125"
              aria-label={`${s} star`}
            >
              <span className={(hover || rating) >= s ? "" : "opacity-30 grayscale"}>⭐</span>
            </button>
          ))}
        </div>
        <textarea
          className={inputClass}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          required
        />
        <button className={`${btnClass} w-full`} disabled={busy}>
          {busy ? "Sending..." : "Submit Feedback"}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">What students say</h3>
        {list === null ? (
          <BookLoader label="Loading feedback" />
        ) : list.length ? (
          list.slice(0, 8).map((f) => (
            <article key={f.id} className="glass animate-rise rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{f.userName}</p>
                <p className="text-sm">{"⭐".repeat(f.rating)}</p>
              </div>
              <p className="text-muted-foreground text-xs">{f.registrationId}</p>
              <p className="mt-2 text-sm">{f.comment}</p>
            </article>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No feedback yet — be the first!</p>
        )}
      </div>
    </section>
  );
}