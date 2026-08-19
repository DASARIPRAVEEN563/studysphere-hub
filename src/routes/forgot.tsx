import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { btnClass, Field, inputClass, PasswordInput } from "@/components/Field";
import { api } from "@/lib/api";
import {
  sendPasswordChangedNotice,
  sendPasswordResetCode,
} from "@/lib/face-verification-email.functions";

export const Route = createFileRoute("/forgot")({
  head: () => ({
    meta: [
      { title: "Forgot Password | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Reset your notes hub password with a code sent to your registered email.",
      },
      { property: "og:title", content: "Forgot Password | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Recover access with an emailed reset code." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [registrationId, setRegistrationId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{
        email: string;
        fullName: string;
        code: string;
        registrationId?: string;
        department?: string;
        year?: string;
        semester?: string;
      }>("/api/auth/forgot/code", { body: { registrationId } });
      await sendPasswordResetCode({
        data: {
          to: res.email,
          fullName: res.fullName ?? "Student",
          code: res.code,
          details: {
            registrationId: res.registrationId ?? registrationId,
            department: res.department,
            year: res.year,
            semester: res.semester,
            email: res.email,
          },
        },
      });
      const [name = "", domain = ""] = res.email.split("@");
      setMaskedEmail(`${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`);
      toast.success("Verification code sent to your registered email");
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
      const res = await api<{
        email?: string | null;
        fullName?: string;
        registrationId?: string;
        department?: string;
        year?: string;
        semester?: string;
      }>("/api/auth/forgot/reset", { body: { registrationId, code, newPassword } });
      toast.success("Password updated. Please login.");
      if (res?.email) {
        try {
          await sendPasswordChangedNotice({
            data: {
              to: res.email,
              fullName: res.fullName ?? "Student",
              details: {
                registrationId: res.registrationId ?? registrationId,
                department: res.department,
                year: res.year,
                semester: res.semester,
                email: res.email,
              },
            },
          });
          toast.success("Your password was changed — a confirmation email was sent.");
        } catch {
          toast.message("Password changed — the email alert could not be delivered.");
        }
      }
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
          <p className="text-muted-foreground mb-4 text-sm">
            We send a 6-digit code to the email ID saved on your account.
          </p>
          {step === 1 ? (
            <form onSubmit={sendCode} className="space-y-5">
              <Field label="Registration ID (Hall Ticket No)">
                <input
                  className={`${inputClass} uppercase`}
                  value={registrationId}
                  onChange={(e) => setRegistrationId(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="Hall ticket no"
                  required
                />
              </Field>
              <button className={`${btnClass} w-full`} disabled={loading}>
                {loading ? "Sending code..." : "Send code to my email"}
              </button>
            </form>
          ) : (
            <form onSubmit={reset} className="space-y-5">
              <p className="bg-primary/15 text-cyan rounded-xl px-4 py-3 text-sm">
                Code sent to {maskedEmail}
              </p>
              <Field label="6-digit code from your email">
                <input
                  className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  required
                />
              </Field>
              <Field label="New Password">
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
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