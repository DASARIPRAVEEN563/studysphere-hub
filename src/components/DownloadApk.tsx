import { toast } from "sonner";
import { btnClass } from "./Field";
import { APK_URL, APK_VERSION, APK_UPDATED } from "@/lib/apk";

/**
 * Android app card in the profile page: shows the current APK build and lets a
 * student download and install it directly. Downloaded notes inside the app are
 * kept in the phone's internal app storage (like WhatsApp media).
 */
export function DownloadApk() {
  const download = () => {
    if (!APK_URL) {
      toast.error("The Android app build is not published yet. Please check back soon.");
      return;
    }
    toast.success("Downloading the SKNSH app…");
    window.location.href = APK_URL;
  };

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <img
          src="/app-icon-192.png"
          alt="SKNSH Android app icon"
          loading="lazy"
          width={48}
          height={48}
          className="size-12 rounded-2xl shadow-lg"
        />
        <div className="min-w-0">
          <h3 className="text-lg font-black">📱 SKNSH Android app</h3>
          <p className="text-muted-foreground text-xs">
            Version {APK_VERSION} · updated {APK_UPDATED}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Install the app to keep your downloaded notes saved inside the phone's internal app storage,
        and get notifications for new notes, likes and admin messages.
      </p>
      <button type="button" onClick={download} className={`${btnClass} mt-4 w-full`}>
        ⬇ Download APK
      </button>
      <p className="text-muted-foreground mt-3 text-[11px]">
        Android may ask to allow installs from your browser — tap Allow, then Install. Installing a
        newer version simply replaces the old one.
      </p>
    </section>
  );
}
