import { useState } from "react";
import guideSignup from "@/assets/guide-signup.jpg";
import guideVerify from "@/assets/guide-verify.jpg";
import guideNotes from "@/assets/guide-notes.jpg";
import guideShare from "@/assets/guide-share.jpg";
import { btnClass, ghostBtnClass } from "./Field";

const STEPS = [
  {
    title: "Step 1 · Your account",
    image: guideSignup,
    points: [
      "You signed up with your full name, hall ticket no, department, year and semester.",
      "Forgot your password later? Reset it with a code sent to your registered email.",
      "Admins sign in from the separate Admin Login page.",
    ],
  },
  {
    title: "Step 2 · Verify your face & email",
    image: guideVerify,
    points: [
      "Add your email ID in the Profile page first, then start live face verification.",
      "Only one person must face the camera — blink once and your photo is captured.",
      "A 6-digit code reaches your inbox; paste it here to unlock the whole website.",
    ],
  },
  {
    title: "Step 3 · Find notes fast",
    image: guideNotes,
    points: [
      "Open Notes and walk through Department → Year → Semester → Subject.",
      "Use the filters and the search box to jump straight to a subject or file.",
      "View a file before downloading, and sort by most liked, viewed or downloaded.",
    ],
  },
  {
    title: "Step 4 · Share, earn stars, get help",
    image: guideShare,
    points: [
      "Upload PDF / JPG / PNG / WEBP notes — every upload earns a star.",
      "Likes on your notes push you up the leaderboard.",
      "Use Chat with Admin for requests, enquiries or missing notes.",
    ],
  },
];

/** Full-screen step-by-step walkthrough shown right after signup / login. */
export function HowToUse({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const step = STEPS[page]!;
  const last = page === STEPS.length - 1;

  return (
    <div className="bg-background/85 fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4 backdrop-blur-md">
      <section className="glass animate-rise w-full max-w-lg rounded-3xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="gradient-text text-xl font-black">How to use this website</h3>
            <p className="text-muted-foreground text-xs">
              Step {page + 1} of {STEPS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip the guide"
            className="text-muted-foreground text-sm font-semibold underline"
          >
            Skip
          </button>
        </div>

        <article key={page} className="animate-rise mt-4 space-y-3">
          <img
            src={step.image}
            alt={step.title}
            loading="lazy"
            width={768}
            height={512}
            className="h-40 w-full rounded-2xl object-cover sm:h-48"
          />
          <h4 className="text-lg font-black">{step.title}</h4>
          <ul className="space-y-2 text-sm">
            {step.points.map((p) => (
              <li key={p} className="glass rounded-2xl px-4 py-2.5">
                {p}
              </li>
            ))}
          </ul>
        </article>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className={ghostBtnClass}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Back
          </button>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`size-2.5 rounded-full transition-all ${
                  i === page ? "hero-gradient w-6" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            className={btnClass}
            onClick={() => (last ? onClose() : setPage((p) => p + 1))}
          >
            {last ? "Start using" : "Next →"}
          </button>
        </div>
      </section>
    </div>
  );
}