import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass } from "@/components/Field";
import { api, auth, type User } from "@/lib/api";

export const Route = createFileRoute("/confirm")({
  head: () => ({
    meta: [
      { title: "Confirm It's You | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content:
          "Confirm the face verification photo emailed to you and unlock notes, sharing and chat.",
      },
      { property: "og:title", content: "Confirm It's You | Students Ka Notes Sharing Hub" },
      {
        property: "og:description",
        content: "One tap identity confirmation for your student account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [detail, setDetail] = useState("Checking your confirmation link...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") ?? "";
    const token = params.get("token") ?? "";
    if (!uid || !token) {
      setState("error");
      setDetail("This link is incomplete. Open the newest verification email again.");
      return;
    }
    api<{ user: User; token?: string }>("/api/auth/confirm-identity", { body: { uid, token } })
      .then((r) => {
        const me = auth.user();
        // Signing the student straight in means the email tap unlocks everything
        // without asking them to log in again.
        if (r.token) auth.save(r.token, r.user);
        else if (me && me.id === r.user.id) auth.setUser(r.user);
        setState("done");
        setDetail("Identity confirmed — every feature is unlocked, no login needed.");
        setTimeout(() => navigate({ to: "/home", replace: true }), 1600);
      })
      .catch((e) => {
        setState("error");
        setDetail((e as Error).message);
      });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <AnimatedTitle className="mb-8 text-center text-2xl sm:text-3xl" />
        <div className="glass animate-rise space-y-4 rounded-3xl p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full text-3xl">
            {state === "done" ? "✅" : state === "error" ? "⚠️" : "⏳"}
          </div>
          <h1 className="text-2xl font-black">
            {state === "done" ? "It's you — confirmed" : "Identity confirmation"}
          </h1>
          <p className="text-muted-foreground text-sm">{detail}</p>
          <button
            className={`${btnClass} w-full`}
            onClick={() => navigate({ to: auth.user() ? "/home" : "/login" })}
          >
            {auth.user() ? "Go to Home" : "Go to Login"}
          </button>
          <Link to="/profile" className="text-cyan block text-xs hover:underline">
            Open my profile
          </Link>
        </div>
      </div>
    </div>
  );
}
