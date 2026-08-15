import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { auth } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Students Ka Notes Sharing Hub | Share College Notes" },
      {
        name: "description",
        content:
          "A premium student platform to share and download department, year and semester notes stored on Google Drive.",
      },
      { property: "og:title", content: "Students Ka Notes Sharing Hub" },
      {
        property: "og:description",
        content: "Share and download college notes by department, year, semester and subject.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!intro && auth.user()) navigate({ to: "/home", replace: true });
  }, [intro, navigate]);

  if (intro) {
    return (
      <div className="bg-background grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <div className="hero-gradient glow animate-float mx-auto mb-8 grid size-24 place-items-center rounded-3xl text-4xl font-black text-white">
            S
          </div>
          <AnimatedTitle className="text-3xl sm:text-5xl" />
          <p className="text-muted-foreground animate-rise mt-6 text-sm tracking-[0.3em] uppercase">
            Loading your hub...
          </p>
          <div className="mx-auto mt-6 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="hero-gradient animate-shine h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <AnimatedTitle className="text-center text-4xl sm:text-6xl" />
        <p className="text-muted-foreground animate-rise mx-auto mt-6 max-w-2xl text-center text-lg">
          One colourful hub for every department, year and semester. Upload once, help everyone —
          notes stored safely on Google Drive.
        </p>
        <div className="animate-rise mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/login"
            className="hero-gradient rounded-xl px-7 py-3 font-bold text-white shadow-xl transition-transform hover:-translate-y-1"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="rounded-xl border border-white/20 px-7 py-3 font-bold transition-colors hover:bg-white/10"
          >
            Sign Up
          </Link>
          <Link
            to="/admin-login"
            className="text-pink rounded-xl border border-white/20 px-7 py-3 font-bold transition-colors hover:bg-white/10"
          >
            Admin
          </Link>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {[
            { t: "Folder Navigation", d: "Department → Year → Semester → Subject → Files", i: "🗂️" },
            { t: "Google Drive Storage", d: "Unlimited subject files, organised automatically", i: "☁️" },
            { t: "Admin Portal", d: "Rename subjects, move files, publish notices", i: "🛡️" },
          ].map((f, i) => (
            <div
              key={f.t}
              className="glass animate-rise rounded-3xl p-7 transition-transform hover:-translate-y-2"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="hero-gradient mb-4 grid size-12 place-items-center rounded-2xl text-xl">
                {f.i}
              </div>
              <h2 className="text-lg font-black">{f.t}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
