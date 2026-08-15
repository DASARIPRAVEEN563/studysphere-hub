import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, auth, type User } from "@/lib/api";
import { btnClass, ghostBtnClass } from "./Field";

type Detector = { detect: (src: CanvasImageSource) => Promise<unknown[]> };

/** Live face verification with automatic capture triggered by an eye blink. */
export function FaceVerify({ user, onVerified }: { user: User; onVerified: (u: User) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const hasEmail = Boolean(user.email && user.email.includes("@"));

  const stop = () => {
    if (loopRef.current) window.clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    if (!hasEmail) {
      toast.error("Add your email ID first", {
        description: "Save a valid email in your profile before face verification.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setLive(true);
      setHint("Look at the camera and blink once — capture is automatic.");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        startBlinkLoop();
      });
    } catch {
      toast.error("Camera permission is required for live face verification");
    }
  };

  const grabFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { canvas, ctx };
  };

  const startBlinkLoop = () => {
    const history: number[] = [];
    let dipped = false;
    const FD = (window as unknown as { FaceDetector?: new (o?: unknown) => Detector }).FaceDetector;
    const detector = FD ? new FD({ fastMode: true, maxDetectedFaces: 5 }) : null;

    loopRef.current = window.setInterval(async () => {
      if (busyRef.current) return;
      const frame = grabFrame();
      if (!frame) return;
      const { canvas, ctx } = frame;

      let faces = 1;
      if (detector) {
        try {
          faces = (await detector.detect(canvas)).length;
        } catch {
          faces = 1;
        }
        if (faces === 0) {
          setHint("No face detected — center your face in the frame.");
          return;
        }
        if (faces > 1) {
          setHint("More than one person detected — only one person is allowed.");
          return;
        }
      }

      // Average brightness of the eye band (upper-middle strip of the face area).
      const band = ctx.getImageData(80, 60, 160, 40).data;
      let sum = 0;
      for (let i = 0; i < band.length; i += 4) {
        sum += 0.299 * band[i]! + 0.587 * band[i + 1]! + 0.114 * band[i + 2]!;
      }
      const level = sum / (band.length / 4);
      history.push(level);
      if (history.length > 16) history.shift();
      if (history.length < 8) return;

      const baseline = history.slice(0, -1).reduce((a, b) => a + b, 0) / (history.length - 1);
      if (!dipped && level < baseline * 0.955) {
        dipped = true;
        setHint("Blink detected — hold still...");
        return;
      }
      if (dipped && level > baseline * 0.985) {
        dipped = false;
        void submit(canvas.toDataURL("image/jpeg", 0.85), faces);
      }
    }, 120);
  };

  const submit = async (image: string, faces: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api<{ user: User; emailedTo?: string; emailSent?: boolean; message?: string }>(
        "/api/profile/face-verify",
        { method: "POST", body: { image, faces, email: user.email } },
      );
      auth.setUser(r.user);
      onVerified(r.user);
      stop();
      toast.success("Face verified is successfully completed", {
        description: r.emailSent
          ? `A confirmation mail has been sent to ${r.emailedTo ?? user.email}.`
          : `Mail could not be sent right now — check that the mail server is configured for ${
              r.emailedTo ?? user.email
            }.`,
      });
    } catch (e) {
      toast.error((e as Error).message);
      setHint("Verification failed — try blinking again.");
    } finally {
      busyRef.current = false;
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
        Only one person may be in frame. Blink once and the capture happens automatically — the
        photo is stored securely and never shown here.
      </p>

      {!hasEmail && (
        <p className="bg-destructive/15 text-destructive mt-4 rounded-xl px-4 py-3 text-sm font-semibold">
          Save your email ID in the profile details above to unlock face verification.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="border-primary/40 relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed bg-black/30">
          {live ? (
            <>
              <video ref={videoRef} playsInline muted className="size-full object-cover" />
              <span className="hero-gradient animate-scan absolute inset-x-0 h-0.5" />
            </>
          ) : (
            <div className="text-muted-foreground grid size-full place-items-center px-3 text-center text-sm">
              {user.faceVerified ? "🔒 Verification on file" : "🙂 Camera is off"}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3">
          {!live ? (
            <button onClick={start} className={btnClass} disabled={!hasEmail} type="button">
              {user.faceVerified ? "Re-verify with camera" : "Start live verification"}
            </button>
          ) : (
            <>
              <p className="text-cyan text-sm font-semibold">{busy ? "Verifying..." : hint}</p>
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
