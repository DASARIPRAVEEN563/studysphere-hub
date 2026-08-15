import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, auth, type User } from "@/lib/api";
import { btnClass, ghostBtnClass } from "./Field";

export function FaceVerify({ user, onVerified }: { user: User; onVerified: (u: User) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Camera permission is required for live face verification");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.8);
    setBusy(true);
    try {
      const r = await api<{ user: User }>("/api/profile/face-verify", {
        method: "POST",
        body: { image },
      });
      auth.setUser(r.user);
      onVerified(r.user);
      stop();
      toast.success("Face verified — downloads and sharing unlocked");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">Live Face Verification</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
            user.faceVerified ? "bg-cyan/20 text-cyan" : "bg-destructive/20 text-destructive"
          }`}
        >
          {user.faceVerified ? "Verified" : "Not verified"}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        Verification is required before you can download or share notes.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <div className="border-primary/40 relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed bg-black/30">
          {live ? (
            <>
              <video ref={videoRef} playsInline muted className="size-full object-cover" />
              <span className="hero-gradient animate-scan absolute inset-x-0 h-0.5" />
            </>
          ) : user.faceImage ? (
            <img src={user.faceImage} alt="Verified face" className="size-full object-cover" />
          ) : (
            <div className="text-muted-foreground grid size-full place-items-center text-sm">
              🙂 No capture yet
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3">
          {!live ? (
            <button onClick={start} className={btnClass} type="button">
              {user.faceVerified ? "Re-verify with camera" : "Start live verification"}
            </button>
          ) : (
            <>
              <button onClick={capture} className={btnClass} disabled={busy} type="button">
                {busy ? "Verifying..." : "Capture & verify"}
              </button>
              <button onClick={stop} className={ghostBtnClass} type="button">
                Cancel
              </button>
            </>
          )}
          {user.faceVerifiedAt && (
            <p className="text-muted-foreground text-xs">
              Verified on {new Date(user.faceVerifiedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}