import { useState } from "react";
import guideSignup from "@/assets/guide-signup.jpg";
import guideVerify from "@/assets/guide-verify.jpg";
import guideNotes from "@/assets/guide-notes.jpg";
import guideShare from "@/assets/guide-share.jpg";
import { ghostBtnClass } from "./Field";

const STEPS = [
  {
    title: "1 · Create your account",
    image: guideSignup,
    points: [
      "Sign up with your full name, hall ticket no, department, year and semester.",
      "Pick a security question — it is the only way to reset a forgotten password.",
      "Admins sign in from the separate Admin Login page.",
    ],
  },
  {
    title: "2 · Verify your face & email",
    image: guideVerify,
    points: [
      "Add your email ID in the profile page first, then start live face verification.",
      "Blink once — the camera captures your face automatically.",
      "A 6-digit code reaches your inbox; paste it here to unlock the whole website.",
    ],
  },
  {
    title: "3 · Find notes fast",
    image: guideNotes,
    points: [
      "Open Notes and walk through Department → Year → Semester → Subject.",
      "Use the filters and the search icon to jump straight to a subject.",
      "View a file before downloading, and sort by most liked, viewed or downloaded.",
    ],
  },
  {
    title: "4 · Share, earn stars, get help",
    image: guideShare,
    points: [
      "Upload PDF / JPG / PNG / WEBP notes — every upload earns a star.",
      "Likes on your notes push you up the leaderboard.",
      "Use Chat with Admin for requests, enquiries or missing notes.",
    ],
  },
];

/** Page-by-page roadmap of how to use the website. */
export function AboutGuide() {
  const [page, setPage] = useState(0);
  const step = STEPS[page]!;

  return (
    <section className="glass animate-rise rounded-3xl p-5 sm:p-8">
      <h3 className="text-lg font-black">About · How to use this website</h3>
      <p className="text-muted-foreground text-sm">
        A short roadmap — turn the pages to see each step.
      </p>

      <article key={page} className="animate-rise mt-5 space-y-4">
        <img
          src={step.image}
          alt={step.title}
          loading="lazy"
          width={768}
          height={512}
          className="w-full rounded-2xl object-cover"
        />
        <h4 className="gradient-text text-xl font-black">{step.title}</h4>
        <ul className="space-y-2 text-sm">
          {step.points.map((p) => (
            <li key={p} className="glass rounded-2xl px-4 py-3">
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
            <button
              key={s.title}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setPage(i)}
              className={`size-2.5 rounded-full transition-all ${
                i === page ? "hero-gradient w-6" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className={ghostBtnClass}
          onClick={() => setPage((p) => Math.min(STEPS.length - 1, p + 1))}
          disabled={page === STEPS.length - 1}
        >
          Next →
        </button>
      </div>
    </section>
  );
}
