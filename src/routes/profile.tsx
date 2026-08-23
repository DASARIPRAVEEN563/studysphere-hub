import { createFileRoute } from "@tanstack/react-router";
import { UserImage } from "@/components/UserImage";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireAuth } from "@/components/AppShell";
import { AdminCreator } from "@/components/AdminCreator";
import { btnClass, Field, inputClass } from "@/components/Field";
import { BookLoader } from "@/components/BookLoader";
import { FaceVerify } from "@/components/FaceVerify";
import { ShareSite } from "@/components/ShareSite";
import { Leaderboard } from "@/components/Leaderboard";
import { LikeNotifications } from "@/components/LikeNotifications";
import { ThemePicker } from "@/components/ThemePicker";
import { DownloadApk } from "@/components/DownloadApk";
import { StarShare } from "@/components/StarShare";
import { api, auth, DEPARTMENTS, SEMESTERS, YEARS, type User } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content: "Update your department, year, semester and picture, and track sharing stats.",
      },
      { property: "og:title", content: "My Profile | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Manage your student profile and view counters." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const cached = useRequireAuth();
  const [user, setUser] = useState<User | null>(cached);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<{ user: User }>("/api/profile")
      .then((r) => {
        setUser(r.user);
        auth.setUser(r.user);
      })
      .catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const r = await api<{ user: User }>("/api/profile", {
        method: "PUT",
        body: {
          department: user.department,
          year: user.year,
          semester: user.semester,
          email: user.email ?? "",
          profilePicture: user.profilePicture,
        },
      });
      setUser(r.user);
      auth.setUser(r.user);
      toast.success("Profile updated");
      setEditing(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** Photos are shrunk to a small square before saving so the profile stays fast. */
  const pickPicture = (file: File | null) => {
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return setUser({ ...user, profilePicture: raw });
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        setUser({ ...user, profilePicture: canvas.toDataURL("image/jpeg", 0.8) });
      };
      img.onerror = () => setUser({ ...user, profilePicture: raw });
      img.src = raw;
    };
    reader.readAsDataURL(file);
  };

  /** Email is frozen once the face + code verification is complete. */
  const emailLocked = Boolean(user?.faceVerified && user?.identityConfirmed);

  if (!user)
    return (
      <AppShell title="My Profile">
        <BookLoader label="Loading profile" />
      </AppShell>
    );

  return (
    <AppShell title="My Profile">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="glass animate-rise rounded-3xl p-8 text-center transition-transform hover:-translate-y-1">
          <div className="hero-gradient glow mx-auto grid size-28 place-items-center overflow-hidden rounded-full text-3xl font-black text-white">
            {user.profilePicture ? (
              <UserImage src={user.profilePicture} alt={user.fullName} className="size-full object-cover" />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <h3 className="mt-4 text-2xl font-black">{user.fullName}</h3>
          <p className="text-muted-foreground text-sm">{user.registrationId}</p>
          <span className="bg-primary/20 text-cyan mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase">
            {user.role}
          </span>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="glass animate-float rounded-2xl p-4">
              <p className="gradient-text text-3xl font-black">{user.sharedCount}</p>
              <p className="text-muted-foreground text-xs">Notes Shared</p>
            </div>
            <div className="glass animate-float rounded-2xl p-4" style={{ animationDelay: "300ms" }}>
              <p className="gradient-text text-3xl font-black">{user.downloadedCount}</p>
              <p className="text-muted-foreground text-xs">Notes Downloaded</p>
            </div>
            <div className="glass animate-float rounded-2xl p-4" style={{ animationDelay: "600ms" }}>
              <p className="text-3xl font-black">⭐ {user.stars ?? 0}</p>
              <p className="text-muted-foreground text-xs">Stars Earned</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1 text-lg">
            {Array.from({ length: Math.min(user.stars ?? 0, 20) }).map((_, i) => (
              <span key={i} className="animate-star-pop" style={{ animationDelay: `${i * 60}ms` }}>
                ⭐
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-6">
        {!editing ? (
          <section className="glass animate-rise relative rounded-3xl p-8">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit profile"
              className="hero-gradient absolute top-4 right-4 grid size-10 place-items-center rounded-xl text-white shadow-lg transition-transform hover:scale-110"
            >
              ✏️
            </button>
            <h3 className="text-lg font-black">Academic details</h3>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Email ID", user.email || "Not added yet"],
                ["Department", user.department],
                ["Year", user.year],
                ["Semester", user.semester],
              ].map(([k, v]) => (
                <div key={k} className="glass rounded-2xl p-4">
                  <dt className="text-muted-foreground text-xs font-semibold uppercase">{k}</dt>
                  <dd className="mt-1 font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
        <form onSubmit={save} className="glass animate-rise space-y-5 rounded-3xl p-8">
          <h3 className="text-lg font-black">Edit academic details</h3>
          <Field label="Email ID (required for face verification)">
            <input
              type="email"
              className={`${inputClass} ${emailLocked ? "opacity-70" : ""}`}
              value={user.email ?? ""}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              placeholder="you@example.com"
              required
              readOnly={emailLocked}
              disabled={emailLocked}
            />
            {emailLocked && (
              <span className="text-muted-foreground text-xs">
                🔒 Locked — your email ID cannot be changed after face verification.
              </span>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Department">
              <select
                className={inputClass}
                value={user.department}
                onChange={(e) => setUser({ ...user, department: e.target.value })}
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
                value={user.year}
                onChange={(e) => setUser({ ...user, year: e.target.value })}
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
                value={user.semester}
                onChange={(e) => setUser({ ...user, semester: e.target.value })}
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s} className="bg-card">
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Profile Picture">
            <input
              type="file"
              accept="image/*"
              className={inputClass}
              onChange={(e) => pickPicture(e.target.files?.[0] ?? null)}
            />
          </Field>
          <button className={btnClass} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="ml-3 text-sm font-semibold underline">
            Cancel
          </button>
        </form>
        )}
        <FaceVerify user={user} onVerified={setUser} />
        <LikeNotifications />
        <Leaderboard meId={user.id} />
        <AdminCreator user={user} />
        <ThemePicker />
        <ShareSite />
        <StarShare user={user} />
        <DownloadApk />
        </div>
      </div>
    </AppShell>
  );
}