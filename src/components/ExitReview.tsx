import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, auth } from "@/lib/api";
import { btnClass, ghostBtnClass, inputClass } from "./Field";

/**
 * Farewell card shown when the student leaves: a mandatory thank-you with their
 * name, plus an optional rating when they have not reviewed the hub yet.
 */
export function ExitReview({
  name,
  onClose,
  onFinish,
}: {
  name: string;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [alreadyRated, setAlreadyRated] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ given: boolean }>("/api/feedback/mine")
      .then((r) => setAlreadyRated(!!r.given))
      .catch(() => setAlreadyRated(true));
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/feedback", { body: { rating, comment: comment || "Thanks!" } });
      toast.success("Thanks for the review!");
      onFinish();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="glass animate-rise w-full max-w-md space-y-4 rounded-3xl p-6 text-center sm:p-8">
        <p className="text-4xl">🙏</p>
        <h3 className="text-2xl font-black">
          Thank you, <span className="gradient-text">{name}</span>!
        </h3>
        <p className="text-muted-foreground text-sm">
          Thanks for using Students Ka Notes Sharing Hub. See you again soon.
        </p>

        {/* Students who already reviewed the hub are never asked again. */}
        {!alreadyRated && (
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold uppercase opacity-70">Rate us before you go</p>
            <div className="flex justify-center gap-1 text-3xl">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  aria-label={`${s} star`}
                  className="transition-transform hover:scale-125"
                >
                  <span className={rating >= s ? "" : "opacity-30 grayscale"}>⭐</span>
                </button>
              ))}
            </div>
            <textarea
              className={inputClass}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any suggestion? (optional)"
            />
            <button type="button" onClick={submit} className={`${btnClass} w-full`} disabled={busy}>
              {busy ? "Sending..." : "Send review & exit"}
            </button>
          </div>
        )}


        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${ghostBtnClass} flex-1`}>
            Stay here
          </button>
          <button type="button" onClick={onFinish} className={`${btnClass} flex-1`}>
            {alreadyRated ? "Exit" : "Skip & exit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Convenience wrapper reading the signed-in student's name. */
export function useExitName() {
  return auth.user()?.fullName ?? "friend";
}
