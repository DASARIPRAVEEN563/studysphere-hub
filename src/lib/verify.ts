import { toast } from "sonner";
import { auth } from "./api";

/** Blocks downloads/uploads until the student completes live face verification. */
export function ensureFaceVerified(action: "download" | "share"): boolean {
  const user = auth.user();
  if (user?.faceVerified) return true;
  toast.error("You are not face verified", {
    description: `Complete live face verification in your Profile before you ${action} notes.`,
  });
  return false;
}