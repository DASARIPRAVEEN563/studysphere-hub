import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, auth, type User } from "@/lib/api";
import { PageName } from "./AnimatedTitle";
import { Logo3D } from "./Logo3D";
import { BookLoaderOverlay } from "./BookLoader";
import { ExitReview } from "./ExitReview";
import { HowToUse } from "./HowToUse";

/**
 * The stored session copy can be older than the server (a student verifies on
 * one device, or a save failed while storage was full). Re-reading the profile
 * shortly after mount is what keeps Notes / Share / Chat unlocked.
 */
let lastProfileSync = 0;
async function syncProfile() {
  if (!auth.token()) return;
  if (Date.now() - lastProfileSync < 20000) return;
  lastProfileSync = Date.now();
  try {
    const r = await api<{ user: User }>("/api/profile");
    if (r?.user) auth.setUser(r.user);
  } catch {
    /* offline — keep the stored copy */
  }
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setUser(auth.user());
    sync();
    setReady(true);
    void syncProfile();
    window.addEventListener("sknsh-auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sknsh-auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { user, ready };
}


export function useRequireAuth(role?: "admin") {
  const { user, ready } = useAuthUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/login", replace: true });
    else if (role && user.role !== role) navigate({ to: "/home", replace: true });
  }, [ready, user, role, navigate]);
  return user;
}

/** Students unlock the whole site only after face verification + the "It's me" email click. */
export function isUnlocked(user: User | null | undefined) {
  return !!user && (user.role === "admin" || (!!user.faceVerified && !!user.identityConfirmed));
}

/** Guards notes / share / chat: locked users are bounced back to their profile. */
export function useRequireVerified() {
  const user = useRequireAuth();
  const navigate = useNavigate();
  // Give the fresh profile a moment to arrive before locking anyone out, so a
  // verified student never gets pushed back by a stale local copy.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      lastProfileSync = 0;
      await syncProfile();
      if (alive) setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!checked) return;
    if (user && !isUnlocked(user)) {
      toast.error("You are not verified yet", {
        description:
          "Finish live face verification and enter the emailed code to unlock this page.",
      });
      navigate({ to: "/profile", replace: true });
    }
  }, [checked, user, navigate]);
  return user;
}

const NAV = [
  { to: "/home", label: "Home", short: "Home", icon: "🏠" },
  { to: "/notes", label: "Notes", short: "Notes", icon: "📚" },
  { to: "/share", label: "Share Notes", short: "Share", icon: "⬆️" },
  { to: "/chat", label: "Chat with Admin", short: "Chat", icon: "💬" },
  { to: "/profile", label: "Profile", short: "Profile", icon: "👤" },
] as const;

export function AppShell({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRouterLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [exiting, setExiting] = useState(false);
  const [guide, setGuide] = useState(false);

  // Step-by-step "how to use" walkthrough — shown once per account, right
  // after signup or login.
  useEffect(() => {
    if (!user) return;
    const key = `sknsh_guide_${user.id}`;
    if (localStorage.getItem(key)) return;
    setGuide(true);
  }, [user]);

  const closeGuide = () => {
    if (user) localStorage.setItem(`sknsh_guide_${user.id}`, "1");
    setGuide(false);
  };

  const doLogout = () => {
    auth.clear();
    toast.success("Logged out successfully");
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen">
      {isRouterLoading && <BookLoaderOverlay label={title} />}
      <header className="glass sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <Link to="/home" className="flex min-w-0 items-center gap-2">
            <Logo3D size={34} className="sm:!h-10 sm:!w-10" />
            <span className="gradient-text text-sm font-black tracking-wide">
              SKNSH
            </span>
          </Link>
          <nav className="scrollbar-none -mx-1 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 md:flex">
            {NAV.filter((n) => !(user?.role === "admin" && n.to === "/chat")).map((n) => {
              const locked = !isUnlocked(user) && n.to !== "/home" && n.to !== "/profile";
              return (
                <Link
                  key={n.to}
                  to={locked ? "/profile" : n.to}
                  onClick={() => {
                    if (locked)
                      toast.error("You are not verified yet", {
                        description:
                          "Complete face verification and confirm the email to unlock this tab.",
                      });
                  }}
                  className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all hover:bg-primary/10 sm:text-sm ${
                    pathname === n.to
                      ? "hero-gradient text-white shadow-lg"
                      : locked
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                  }`}
                >
                  {locked ? `🔒 ${n.label}` : n.label}
                </Link>
              );
            })}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all hover:bg-primary/10 sm:text-sm ${
                  pathname === "/admin" ? "hero-gradient text-white" : "text-pink"
                }`}
              >
                Admin Portal
              </Link>
            )}
          </nav>
          <div className="flex-1 md:hidden" />
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-sm md:inline">
                Welcome, <span className="text-foreground font-semibold">{user.fullName}</span>
              </span>
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold md:hidden ${
                    pathname === "/admin" ? "hero-gradient text-white" : "text-pink border border-border"
                  }`}
                >
                  Admin
                </Link>
              )}
              <button
                onClick={() => setExiting(true)}
                aria-label="Logout"
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted sm:text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-8 md:pb-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
          <PageName name={title} />
          {actions}
        </div>
        {children}
      </main>
      {/* Phone-first bottom navigation: thumb-reachable, always visible. */}
      {user && (
        <nav className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 rounded-none border-x-0 border-b-0 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] md:hidden">
          {NAV.filter((n) => !(user.role === "admin" && n.to === "/chat")).map((n) => {
            const locked = !isUnlocked(user) && n.to !== "/home" && n.to !== "/profile";
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={locked ? "/profile" : n.to}
                onClick={() => {
                  if (locked)
                    toast.error("You are not verified yet", {
                      description: "Complete face verification to unlock this tab.",
                    });
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-bold ${
                  active
                    ? "hero-gradient text-white shadow-lg"
                    : locked
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground"
                }`}
              >
                <span className="text-base leading-none">{locked ? "🔒" : n.icon}</span>
                {n.short}
              </Link>
            );
          })}
        </nav>
      )}
      {exiting && user && (
        <ExitReview
          name={user.fullName}
          onClose={() => setExiting(false)}
          onFinish={() => {
            setExiting(false);
            doLogout();
          }}
        />
      )}
      {guide && user && <HowToUse onClose={closeGuide} />}
    </div>
  );
}