import { createFileRoute } from "@tanstack/react-router";

const SHARDS = [
  "users",
  "notes",
  "content",
  "feedback",
  "chats",
  "notifications",
  "likes",
] as const;

function authorized(request: Request): boolean {
  const secret = process.env["BACKEND_BRIDGE_SECRET"];
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/state")({
  server: {
    handlers: {
      // GET /api/public/state?shard=users -> { data: [...] }
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const shard = new URL(request.url).searchParams.get("shard") ?? "";
        if (!(SHARDS as readonly string[]).includes(shard)) return json({ error: "Unknown shard" }, 400);
        const db = await admin();
        const { data, error } = await db
          .from("app_state")
          .select("data")
          .eq("id", shard)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json({ data: data?.data ?? [] });
      },
      // POST /api/public/state  { shard, data }
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as
          | { shard?: string; data?: unknown }
          | null;
        const shard = body?.shard ?? "";
        if (!(SHARDS as readonly string[]).includes(shard)) return json({ error: "Unknown shard" }, 400);
        if (!Array.isArray(body?.data)) return json({ error: "data must be an array" }, 400);
        const db = await admin();
        const { error } = await db
          .from("app_state")
          .upsert({ id: shard, data: body!.data as any, updated_at: new Date().toISOString() });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      },
    },
  },
});
