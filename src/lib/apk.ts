/**
 * Android app release info shown on the profile page.
 *
 * When a new APK is built, upload it (for example to `public/sknsh.apk` or any
 * public link) and bump the values below — every student then sees the new
 * version and downloads the replacement build from the same card.
 */
export const APK_VERSION = "1.0.0";
export const APK_UPDATED = "Aug 2026";
export const APK_URL = import.meta.env["VITE_APK_URL"] || "/sknsh.apk";
