import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass, Field, inputClass } from "@/components/Field";
import { api } from "@/lib/api";

export const Route = createFileRoute("/forgot")({
  head: () => ({
    meta: [
      { title: "Forgot Password | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Reset your notes hub password using your security question.",
      },
      { property: "og:title", content: "Forgot Password | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Recover access with your security question." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [registrationId, setRegistrationId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const getQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ securityQuestion: string }>("/api/auth/forgot/question", {
        body: { registrationId },
      });
      setQuestion(res.securityQuestion);
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/forgot/reset", {
        body: { registrationId, securityAnswer: answer, newPassword },
      });
      toast.success("Password updated. Please login.");
      navigate({ to: "/login" });
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
        <div className="glass animate-rise rounded-3xl p-8">
          <h2 className="mb-5 text-2xl font-black">Password Recovery</h2>
          {step === 1 ? (
            <form onSubmit={getQuestion} className="space-y-5">
              <Field label="Registration ID">
                <input
                  className={inputClass}
                  value={registrationId}
                  onChange={(e) => setRegistrationId(e.target.value)}
                  required
                />
              </Field>
              <button className={`${btnClass} w-full`} disabled={loading}>
                {loading ? "Checking..." : "Get Security Question"}
              </button>
            </form>
          ) : (
            <form onSubmit={reset} className="space-y-5">
              <p className="bg-primary/15 text-cyan rounded-xl px-4 py-3 text-sm">{question}</p>
              <Field label="Your Answer">
                <input
                  className={inputClass}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                />
              </Field>
              <Field label="New Password">
                <input
                  type="password"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </Field>
              <button className={`${btnClass} w-full`} disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
          <Link
            to="/login"
            className="text-muted-foreground mt-4 block text-center text-xs hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}