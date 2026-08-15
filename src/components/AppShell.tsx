import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { auth, type User } from "@/lib/api";
import { PageName } from "./AnimatedTitle";
import { BookLoaderOverlay } from "./BookLoader";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setUser(auth.user());
    sync();
    setReady(true);
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

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/notes", label: "Notes" },
  { to: "/share", label: "Share Notes" },
  { to: "/chat", label: "Chat with Admin" },
  { to: "/profile", label: "Profile" },
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
  const [flipping, setFlipping] = useState(true);

  useEffect(() => {
    setFlipping(true);
    const t = setTimeout(() => setFlipping(false), 850);
    return () => clearTimeout(t);
  }, [pathname]);

  const logout = () => {
    auth.clear();
    toast.success("Logged out successfully");
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen">
      {(flipping || isRouterLoading) && <BookLoaderOverlay label={title} />}
      <header className="glass sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Link to="/home" className="flex items-center gap-2">
            <span className="hero-gradient glow grid size-9 place-items-center rounded-xl text-lg font-black text-white">
              S
            </span>
            <span className="gradient-text hidden text-sm font-black tracking-wide sm:block">
              SKNSH
            </span>
          </Link>
          <nav className="scrollbar-none -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all hover:bg-primary/10 sm:text-sm ${
                  pathname === n.to
                    ? "hero-gradient text-white shadow-lg"
                    : "text-muted-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
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
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-sm md:inline">
                Welcome, <span className="text-foreground font-semibold">{user.fullName}</span>
              </span>
              <button
                onClick={logout}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
          <PageName name={title} />
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}