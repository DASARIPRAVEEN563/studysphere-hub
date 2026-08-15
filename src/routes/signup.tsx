import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass, Field, inputClass } from "@/components/Field";
import { api, auth, DEPARTMENTS, SEMESTERS, YEARS, type User } from "@/lib/api";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Sign up with your registration ID to start sharing and downloading college notes.",
      },
      { property: "og:title", content: "Create Account | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Join the student notes sharing community." },
    ],
  }),
  component: SignupPage,
});

const QUESTIONS = [
  "What is your nickname?",
  "What is your favourite subject?",
  "What is your mother's maiden name?",
  "Which city were you born in?",
];

function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    registrationId: "",
    password: "",
    securityQuestion: QUESTIONS[0],
    securityAnswer: "",
    department: DEPARTMENTS[0],
    year: YEARS[0],
    semester: SEMESTERS[0],
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>("/api/auth/signup", { body: form });
      auth.save(res.token, res.user);
      toast.success(`Welcome aboard, ${res.user.fullName}!`);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <AnimatedTitle className="mb-8 text-center text-2xl sm:text-3xl" />
        <form onSubmit={submit} className="glass animate-rise space-y-5 rounded-3xl p-8">
          <h2 className="text-2xl font-black">Create your student account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name">
              <input
                className={inputClass}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
            </Field>
            <Field label="Registration ID">
              <input
                className={inputClass}
                value={form.registrationId}
                onChange={(e) => set("registrationId", e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                minLength={6}
                required
              />
            </Field>
            <Field label="Department">
              <select
                className={inputClass}
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} className="bg-card">
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <select
                className={inputClass}
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-card">
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Semester">
              <select
                className={inputClass}
                value={form.semester}
                onChange={(e) => set("semester", e.target.value)}
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s} className="bg-card">
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Security Question">
              <select
                className={inputClass}
                value={form.securityQuestion}
                onChange={(e) => set("securityQuestion", e.target.value)}
              >
                {QUESTIONS.map((q) => (
                  <option key={q} value={q} className="bg-card">
                    {q}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Security Answer">
              <input
                className={inputClass}
                value={form.securityAnswer}
                onChange={(e) => set("securityAnswer", e.target.value)}
                required
              />
            </Field>
          </div>
          <button className={`${btnClass} w-full`} disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
          <p className="text-muted-foreground text-center text-sm">
            Already registered?{" "}
            <Link to="/login" className="text-cyan hover:underline">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}