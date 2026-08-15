import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    if (intro) return;
    navigate({ to: auth.user() ? "/home" : "/login", replace: true });
  }, [intro, navigate]);

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
