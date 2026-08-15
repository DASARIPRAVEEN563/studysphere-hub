import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btnClass, Field, inputClass } from "./Field";
import { api, type User } from "@/lib/api";
import { SUPER_ADMIN_ID } from "@/lib/offline-backend";

export function AdminCreator({ user }: { user: User }) {
  const [fullName, setFullName] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [admins, setAdmins] = useState<User[]>([]);

  const isMaster = user.registrationId.toUpperCase() === SUPER_ADMIN_ID;

  const load = () =>
    api<{ admins: User[] }>("/api/admin/admins")
      .then((r) => setAdmins(r.admins))
      .catch(() => setAdmins([]));

  useEffect(() => {
    if (isMaster) void load();
  }, [isMaster]);

  if (!isMaster) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/create-admin", {
        body: { fullName, registrationId: registrationId.toUpperCase(), password },
      });
      toast.success("New admin account created");
      setFullName("");
      setRegistrationId("");
      setPassword("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass animate-rise rounded-3xl p-8">
      <h3 className="text-pink text-lg font-black">Master Admin · Create admin account</h3>
      <p className="text-muted-foreground text-sm">
        Only visible to {SUPER_ADMIN_ID}. New IDs can sign in at the admin portal.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Admin Name">
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New Admin ID">
            <input
              className={`${inputClass} uppercase`}
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value.toUpperCase())}
              required
            />
          </Field>
          <Field label="New Password">
            <input
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </Field>
        </div>
        <button className={btnClass} disabled={busy}>
          {busy ? "Creating..." : "Create Admin"}
        </button>
      </form>
      {admins.length > 0 && (
        <ul className="mt-6 space-y-2">
          {admins.map((a) => (
            <li key={a.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
              <span className="font-bold">{a.fullName}</span>
              <span className="text-muted-foreground">{a.registrationId}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
