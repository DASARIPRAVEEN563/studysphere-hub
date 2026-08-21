import { toast } from "sonner";
import { auth } from "./api";

/** Blocks downloads/uploads until the student completes live face verification. */
export function ensureFaceVerified(action: "download" | "share"): boolean {
  if (!ensureOnline(action)) return false;
  const user = auth.user();
  if (user?.faceVerified) return true;
  toast.error("You are not face verified", {
    description: `Complete live face verification in your Profile before you ${action} notes.`,
  });
  return false;
}

/**
 * Uploads and downloads always need the internet — inside the installed app
 * everything else (browsing what is already loaded) keeps working offline.
 */
export function ensureOnline(action: "download" | "share"): boolean {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return true;
  toast.error("You are offline", {
    description:
      action === "share"
        ? "Uploading notes needs internet. You can still browse what is already loaded."
        : "Downloading files needs internet. You can still browse what is already loaded.",
  });
  return false;
}
