import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btnClass } from "./Field";
import {
  APK_UPDATED,
  APK_URL,
  APK_VERSION,
  fetchRelease,
  installedVersion,
  isNewer,
  rememberDownloaded,
  type ApkRelease,
} from "@/lib/apk";

/**
 * Android app card in the profile page: shows the current APK build, tells the
 * student when a newer build has been published, and lets them download and
 * install it directly. Downloaded notes inside the app are kept in the phone's
 * internal app storage (like WhatsApp media).
 */
export function DownloadApk() {
  const [release, setRelease] = useState<ApkRelease>({
    version: APK_VERSION,
    updated: APK_UPDATED,
    url: APK_URL,
  });
  const [installed, setInstalled] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [latest, current] = await Promise.all([fetchRelease(), installedVersion()]);
      if (!alive) return;
      setRelease(latest);
      setInstalled(current);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const updateAvailable = isNewer(release.version, installed);

  const download = () => {
    if (!release.url) {
      toast.error("The Android app build is not published yet. Please check back soon.");
      return;
    }
    rememberDownloaded(release.version);
    setInstalled(release.version);
    toast.success(`Downloading SKNSH ${release.version}…`);
    window.location.href = release.url;
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
            Latest version {release.version} · updated {release.updated}
            {installed ? ` · you have ${installed}` : ""}
          </p>
        </div>
      </div>

      {updateAvailable ? (
        <div className="border-cyan/40 bg-cyan/10 mt-4 rounded-2xl border p-3">
          <p className="text-cyan text-sm font-black">
            🎉 Update available — version {release.version}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {release.notes ?? "A newer build of the app has been published."} Installing it simply
            replaces your current app; your account and saved notes stay.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">
          {installed
            ? "You are on the latest build. "
            : "Install the app to keep your downloaded notes saved inside the phone's internal app storage, and "}
          get notifications for new notes, likes and admin messages.
        </p>
      )}

      <button type="button" onClick={download} className={`${btnClass} mt-4 w-full`}>
        {updateAvailable ? `⬆ Update to ${release.version}` : "⬇ Download APK"}
      </button>
      <p className="text-muted-foreground mt-3 text-[11px]">
        Android may ask to allow installs from your browser — tap Allow, then Install. Installing a
        newer version simply replaces the old one.
      </p>
    </section>
  );
}
