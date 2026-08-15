import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass, Field, inputClass } from "@/components/Field";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { api, auth, type User } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Log in to Students Ka Notes Sharing Hub to browse, share and download semester notes.",
      },
      { property: "og:title", content: "Login | Students Ka Notes Sharing Hub" },
      {
        property: "og:description",
        content: "Access your student account to share and download department notes.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [registrationId, setRegistrationId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<User | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>("/api/auth/login", {
        body: { registrationId, password },
      });
      auth.save(res.token, res.user);
      setWelcome(res.user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      {welcome && (
        <WelcomeOverlay
          name={welcome.fullName}
          subtitle="Taking you to your hub..."
          onDone={() =>
            navigate({ to: welcome.role === "admin" ? "/admin" : "/home", replace: true })
          }
        />
      )}
      <div className="w-full max-w-md">
        <AnimatedTitle className="mb-8 text-center text-2xl sm:text-3xl" />
        <form onSubmit={submit} className="glass animate-rise space-y-5 rounded-3xl p-8">
          <div>
            <h2 className="text-2xl font-black">Student Login</h2>
            <p className="text-muted-foreground text-sm">Enter your registration credentials</p>
          </div>
          <Field label="Registration ID">
            <input
              className={`${inputClass} uppercase`}
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <button className={`${btnClass} w-full`} disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
          <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-sm">
            <Link to="/forgot" className="text-cyan hover:underline">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-pink hover:underline">
              Create account
            </Link>
          </div>
          <Link
            to="/admin-login"
            className="text-muted-foreground block text-center text-xs hover:underline"
          >
            Admin login
          </Link>
        </form>
      </div>
    </div>
  );
}