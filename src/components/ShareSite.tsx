import { toast } from "sonner";

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : "https://students-ka-notes-hub.lovable.app";

const MESSAGE = "Join STUDENTS KA NOTES SHARING HUB — share and download semester notes for free!";

const LINKS = [
  {
    label: "WhatsApp",
    icon: "🟢",
    href: () => `https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${SITE_URL}`)}`,
  },
  {
    label: "Telegram",
    icon: "✈️",
    href: () =>
      `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(MESSAGE)}`,
  },
  {
    label: "Facebook",
    icon: "📘",
    href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`,
  },
  {
    label: "X",
    icon: "✖️",
    href: () =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(MESSAGE)}`,
  },
  {
    label: "Email",
    icon: "✉️",
    href: () =>
      `mailto:?subject=${encodeURIComponent("Students Ka Notes Sharing Hub")}&body=${encodeURIComponent(`${MESSAGE} ${SITE_URL}`)}`,
  },
];

/** Share-the-website options shown on the profile page. */
export function ShareSite() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("Website link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const instagram = async () => {
    await copy();
    toast.info("Link copied — paste it in your Instagram story or bio", {
      description: "Instagram does not allow direct web sharing.",
    });
    window.open("https://www.instagram.com/", "_blank", "noopener");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Students Ka Notes Sharing Hub", text: MESSAGE, url: SITE_URL });
      } catch {
        /* dismissed */
      }
    } else {
      void copy();
    }
  };

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <h3 className="text-lg font-black">Share this website</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Invite your classmates — more notes for everyone.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href()}
            target="_blank"
            rel="noreferrer"
            className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition-transform hover:-translate-y-1"
          >
            <span className="text-xl">{l.icon}</span>
            {l.label}
          </a>
        ))}
        <button
          onClick={instagram}
          className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition-transform hover:-translate-y-1"
        >
          <span className="text-xl">📸</span>
          Instagram
        </button>
        <button
          onClick={copy}
          className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition-transform hover:-translate-y-1"
        >
          <span className="text-xl">🔗</span>
          Copy link
        </button>
        <button
          onClick={nativeShare}
          className="hero-gradient flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-1"
        >
          <span className="text-xl">📤</span>
          More
        </button>
      </div>
    </section>
  );
}
