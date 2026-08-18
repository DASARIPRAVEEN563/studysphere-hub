import { toast } from "sonner";

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://students-ka-notes-hub.lovable.app";

const MESSAGE = "Join STUDENTS KA NOTES SHARING HUB — share and download semester notes for free!";

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

  /** Opens the phone's real share sheet so any installed app can receive the link. */
  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Students Ka Notes Sharing Hub",
          text: MESSAGE,
          url: SITE_URL,
        });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    await copy();
    toast.info("Sharing sheet unavailable — link copied instead");
  };

  const openApp = async (label: string, url: string) => {
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      await copy();
      toast.info(`${label} could not open — link copied, paste it there`);
    }
  };

  const apps = [
    {
      label: "WhatsApp",
      icon: "🟢",
      run: () =>
        openApp("WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${SITE_URL}`)}`),
    },
    {
      label: "Telegram",
      icon: "✈️",
      run: () =>
        openApp(
          "Telegram",
          `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(MESSAGE)}`,
        ),
    },
    {
      label: "Instagram",
      icon: "📸",
      run: async () => {
        await copy();
        toast.info("Link copied — paste it in your Instagram story or bio");
        await openApp("Instagram", "https://www.instagram.com/");
      },
    },
    { label: "Link", icon: "🔗", run: copy },
  ];

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <h3 className="text-lg font-black">Share this website</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Invite your classmates — more notes for everyone.
      </p>
      <button
        onClick={nativeShare}
        className="hero-gradient glow mt-4 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition-transform active:scale-95"
      >
        📤 Share via my apps
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {apps.map((a) => (
          <button
            key={a.label}
            onClick={() => void a.run()}
            className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition-transform active:scale-95 hover:-translate-y-1"
          >
            <span className="text-xl">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
