import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = { redirect_url?: string; redirect_to?: string; client?: { name?: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Missing authorization_id");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { signedIn: false as const, details: null, email: null };
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return {
      signedIn: true as const,
      details: data,
      email: sessionData.session.user.email ?? null,
    };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 text-foreground">
      <p>Could not load this authorization request: {String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-xl text-card-foreground">
        {children}
      </div>
    </main>
  );
}

function Consent() {
  const loaded = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  if (!loaded.signedIn) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-2">Sign in to continue</h1>
        <p className="text-muted-foreground mb-6">
          Sign in with your StudySphere Hub account to approve this connection.
        </p>
        {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
        <button
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error: e } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.href },
            });
            if (e) { setBusy(false); setError(e.message); }
          }}
        >
          Continue with Google
        </button>
      </Shell>
    );
  }

  const clientName = loaded.details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: e } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (e) { setBusy(false); setError(e.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    setRedirectUrl(target);
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-2">Connect {clientName} to StudySphere Hub</h1>
      <p className="text-muted-foreground mb-1">Signed in as {loaded.email ?? "your account"}.</p>
      <p className="text-muted-foreground mb-6">
        This lets {clientName} use StudySphere Hub as you. It does not bypass this app's permissions
        or backend policies.
      </p>
      <ul className="text-sm text-muted-foreground mb-6 list-disc pl-5 space-y-1">
        <li>Share your basic profile</li>
        <li>Share your email address</li>
        <li>Call StudySphere Hub's enabled tools while you are signed in</li>
      </ul>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60"
          disabled={busy}
          onClick={() => decide(true)}
        >
          Approve
        </button>
        <button
          className="flex-1 rounded-xl border border-border py-3 font-semibold disabled:opacity-60"
          disabled={busy}
          onClick={() => decide(false)}
        >
          Cancel connection
        </button>
      </div>
    </Shell>
  );
}
