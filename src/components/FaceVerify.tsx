import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, auth, type User } from "@/lib/api";
import { sendFaceVerificationConfirmation } from "@/lib/face-verification-email.functions";
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
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mail, setMail] = useState<{
    status: "idle" | "queued" | "sending" | "sent" | "failed";
    detail: string;
  }>({ status: "idle", detail: "" });

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
    setMail({ status: "queued", detail: `Queued for ${user.email ?? "your email"}...` });
    try {
      const r = await api<{
        user: User;
        emailedTo?: string;
        emailSent?: boolean;
        confirmToken?: string;
        message?: string;
      }>("/api/profile/face-verify", {
        method: "POST",
        body: { image, faces, email: user.email },
      });
      auth.setUser(r.user);
      onVerified(r.user);
      stop();
      setConfirmToken(r.confirmToken ?? null);
      setLastImage(image);
      toast.success("Face verified is successfully completed");
      const to = r.emailedTo ?? user.email ?? "";
      void deliverEmail(to, image, r.confirmToken ?? null, r.user.id);
    } catch (e) {
      setMail({ status: "idle", detail: "" });
      toast.error((e as Error).message);
      setHint("Verification failed — try blinking again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Email delivery runs independently — verification stays successful either way. */
  const deliverEmail = async (
    to: string,
    image?: string | null,
    token?: string | null,
    uid?: string,
  ) => {
    if (!to) {
      setMail({ status: "failed", detail: "No email ID on file to notify." });
      return;
    }
    setMail({ status: "sending", detail: `Sending confirmation to ${to}...` });
    try {
      const confirmUrl =
        typeof window !== "undefined" && (token ?? confirmToken)
          ? `${window.location.origin}/confirm?uid=${uid ?? user.id}&token=${token ?? confirmToken}`
          : null;
      const r = await sendFaceVerificationConfirmation({
        data: {
          to,
          fullName: user.fullName,
          image: image ?? lastImage,
          confirmUrl,
        },
      });
      setMail({
        status: "sent",
        detail: `Photo + "It's me" link delivered to ${to}${
          r?.messageId ? ` (ref ${r.messageId.slice(0, 8)})` : ""
        }. If it is not in your inbox, check Spam / Promotions / Updates.`,
      });
    } catch (error) {
      console.error("Face verification email failed", error);
      setMail({
        status: "failed",
        detail: `Mail to ${to} could not be delivered — verification is still saved.`,
      });
    }
  };

  if (user.faceVerified && !user.identityConfirmed && !live) {
    return (
      <section className="glass animate-rise space-y-3 rounded-3xl p-6">
        <h3 className="text-lg font-black">Confirm it's you</h3>
        <p className="text-muted-foreground text-sm">
          Your face photo was emailed to <b>{user.email}</b>. Open that mail and tap
          <b> "It's me"</b> to unlock notes, sharing and chat. Until then only Home and Profile are
          available.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void deliverEmail(user.email ?? "", lastImage, confirmToken)}
            className={ghostBtnClass}
            type="button"
          >
            Resend email
          </button>
        </div>
        {mail.status !== "idle" && (
          <p className="text-muted-foreground text-xs">{mail.detail}</p>
        )}
      </section>
    );
  }

  if (user.faceVerified && !live) {
    return (
      <section className="glass animate-rise flex flex-wrap items-center gap-3 rounded-3xl p-5">
        <span className="hero-gradient grid size-11 shrink-0 place-items-center rounded-full text-lg text-white shadow-lg">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black">Face verified</p>
          <p className="text-muted-foreground text-xs">
            {user.faceVerifiedAt
              ? `Verified on ${new Date(user.faceVerifiedAt).toLocaleDateString()}`
              : "You can share and download notes."}
          </p>
        </div>
        <button onClick={start} type="button" className="text-primary text-xs font-bold underline">
          Re-verify
        </button>
      </section>
    );
  }

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
        <div className="border-primary/40 relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed bg-muted">
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
          {mail.status !== "idle" && (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                mail.status === "sent"
                  ? "bg-cyan/15 text-cyan"
                  : mail.status === "failed"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2">
                <span
                  className={
                    mail.status === "queued" || mail.status === "sending"
                      ? "size-2 animate-ping rounded-full bg-current"
                      : "size-2 rounded-full bg-current"
                  }
                />
                Email {mail.status}
              </span>
              <span className="mt-1 block font-medium opacity-90">{mail.detail}</span>
              {mail.status === "failed" && (
                <button
                  type="button"
                  onClick={() => void deliverEmail(user.email ?? "")}
                  className="mt-2 underline"
                >
                  Retry sending
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
