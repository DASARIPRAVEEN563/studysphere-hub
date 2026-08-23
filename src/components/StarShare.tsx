import { useRef, useState } from "react";
import { toast } from "sonner";
import { LOGO_SRC } from "./Logo3D";
import { btnClass, ghostBtnClass } from "./Field";
import type { User } from "@/lib/api";

const SITE = "https://sknsh-by-pd.lovable.app";

/**
 * Candy-Crush style achievement card. The student can brag about the stars
 * they collected on WhatsApp, Instagram or anywhere else — the shared image
 * carries the hub logo, their name and their counters.
 */
export function StarShare({ user }: { user: User }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);

  const stars = user.stars ?? 0;
  const caption =
    `🎉 Congrats to me! I earned ${stars} ⭐ on Students Ka Notes Sharing Hub ` +
    `by sharing ${user.sharedCount} note(s). Join the hub: ${SITE}`;

  /** Paints the achievement card so it can be shared as a real image. */
  const buildImage = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
      bg.addColorStop(0, "#1b1145");
      bg.addColorStop(0.5, "#2b1a6e");
      bg.addColorStop(1, "#0e1b4d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1080);

      ctx.textAlign = "center";
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 46px system-ui, sans-serif";
      ctx.fillText("STUDENTS KA NOTES SHARING HUB", 540, 120);

      const finish = () => {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 96px system-ui, sans-serif";
        ctx.fillText("CONGRATS!", 540, 600);

        ctx.fillStyle = "#f472b6";
        ctx.font = "bold 58px system-ui, sans-serif";
        ctx.fillText(user.fullName.toUpperCase(), 540, 680);

        ctx.fillStyle = "#facc15";
        ctx.font = "bold 110px system-ui, sans-serif";
        ctx.fillText(`⭐ ${stars}`, 540, 810);

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 40px system-ui, sans-serif";
        ctx.fillText(
          `${user.sharedCount} shared · ${user.downloadedCount} downloaded`,
          540,
          876,
        );
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 34px system-ui, sans-serif";
        ctx.fillText(`${user.department} · ${user.year} · ${user.semester}`, 540, 936);
        ctx.fillText("sknsh-by-pd.lovable.app", 540, 1000);
        canvas.toBlob((b) => resolve(b), "image/png");
      };

      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.onload = () => {
        ctx.drawImage(logo, 390, 170, 300, 300);
        finish();
      };
      logo.onerror = () => finish();
      logo.src = LOGO_SRC;
    });

  const share = async () => {
    setBusy(true);
    try {
      const blob = await buildImage();
      const file = blob ? new File([blob], "sknsh-achievement.png", { type: "image/png" }) : null;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (file && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption, title: "My SKNSH achievement" });
      } else if (navigator.share) {
        await navigator.share({ text: caption, url: SITE, title: "My SKNSH achievement" });
      } else if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sknsh-achievement.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast.success("Achievement card saved — post it anywhere!");
      }
    } catch {
      /* the user simply dismissed the share sheet */
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank", "noopener");

  return (
    <section className="glass animate-rise space-y-3 rounded-3xl p-6 text-center">
      <p className="text-3xl">🏆</p>
      <h3 className="text-lg font-black">
        Share your <span className="gradient-text">{stars} star</span> achievement
      </h3>
      <p className="text-muted-foreground text-xs">
        Post your progress card on WhatsApp, Instagram or anywhere — it carries the hub logo and
        your details.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={btnClass} onClick={() => void share()} disabled={busy}>
          {busy ? "Preparing..." : "📣 Share achievement"}
        </button>
        <button type="button" className={ghostBtnClass} onClick={whatsapp}>
          💚 WhatsApp
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}
