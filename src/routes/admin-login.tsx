import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass, Field, inputClass } from "@/components/Field";
import { api, auth, type User } from "@/lib/api";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Administrator sign-in for managing notes, students and home content.",
      },
      { property: "og:title", content: "Admin Login | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Administrator sign-in for the notes hub portal." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [registrationId, setRegistrationId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>("/api/auth/login", {
        body: { registrationId, password },
      });
      if (res.user.role !== "admin") throw new Error("This account is not an administrator");
      auth.save(res.token, res.user);
      toast.success("Admin session started");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <AnimatedTitle className="mb-8 text-center text-2xl sm:text-3xl" />
        <form onSubmit={submit} className="glass animate-rise space-y-5 rounded-3xl p-8">
          <div>
            <h2 className="text-pink text-2xl font-black">Admin Portal Login</h2>
            <p className="text-muted-foreground text-sm">Restricted access</p>
          </div>
          <Field label="Admin ID">
            <input
              className={inputClass}
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
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
            {loading ? "Verifying..." : "Enter Admin Portal"}
          </button>
          <Link to="/login" className="text-muted-foreground block text-center text-xs hover:underline">
            Back to student login
          </Link>
        </form>
      </div>
    </div>
  );
}