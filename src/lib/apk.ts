/**
 * Android app release info shown on the profile page.
 *
 * When a new APK is built, upload it (for example to `public/sknsh.apk` or any
 * public link) and bump the values in `public/apk-release.json` — every student
 * then sees the new version and downloads the replacement build from the card.
 * The values below are only the fallback used when that file cannot be read.
 */
export const APK_VERSION = "1.0.0";
export const APK_UPDATED = "Aug 2026";
export const APK_URL = import.meta.env["VITE_APK_URL"] || "/sknsh.apk";

export type ApkRelease = {
  version: string;
  updated: string;
  url: string;
  notes?: string;
};

const FALLBACK: ApkRelease = { version: APK_VERSION, updated: APK_UPDATED, url: APK_URL };

/** The newest build published with the website. */
export async function fetchRelease(): Promise<ApkRelease> {
  try {
    const res = await fetch(`/apk-release.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as Partial<ApkRelease>;
    return {
      version: String(data.version ?? FALLBACK.version),
      updated: String(data.updated ?? FALLBACK.updated),
      url: String(data.url || FALLBACK.url),
      ...(data.notes ? { notes: String(data.notes) } : {}),
    };
  } catch {
    return FALLBACK;
  }
}

const INSTALLED_KEY = "sknsh_apk_version";

/**
 * Version currently installed on this phone: read from the app itself when
 * running inside the installed app, otherwise from the last build the student
 * downloaded from this card.
 */
export async function installedVersion(): Promise<string | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      return info.version ?? null;
    }
  } catch {
    /* not running inside the app */
  }
  try {
    return localStorage.getItem(INSTALLED_KEY);
  } catch {
    return null;
  }
}

export function rememberDownloaded(version: string) {
  try {
    localStorage.setItem(INSTALLED_KEY, version);
  } catch {
    /* ignore */
  }
}

/** True when `latest` is a newer release than `current` (1.2.10 > 1.2.9). */
export function isNewer(latest: string, current: string | null): boolean {
  if (!current) return false;
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
