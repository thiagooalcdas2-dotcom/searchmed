import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthenticated" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const action: "register" | "ping" | "logout" = body.action || "ping";
    const deviceId: string = body.device_id;
    if (!deviceId) return json({ error: "device_id required" }, 400);

    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("true-client-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("fly-client-ip") ||
      req.headers.get("x-client-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Conta bloqueada?
    const { data: block } = await admin
      .from("account_blocks")
      .select("reason")
      .eq("user_id", userId)
      .maybeSingle();
    if (block) return json({ status: "blocked", reason: block.reason }, 200);

    if (action === "logout") {
      await admin
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "logout" })
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .is("revoked_at", null);
      return json({ status: "ok" });
    }

    if (action === "register") {
      // Revoga todas as outras sessões ativas dessa conta
      await admin
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "superseded" })
        .eq("user_id", userId)
        .neq("device_id", deviceId)
        .is("revoked_at", null);

      // Upsert manual (sem unique constraint): tenta achar
      const { data: existing } = await admin
        .from("user_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .is("revoked_at", null)
        .maybeSingle();

      if (existing) {
        await admin
          .from("user_sessions")
          .update({ last_seen_at: new Date().toISOString(), ip_address: ip, user_agent: ua })
          .eq("id", existing.id);
      } else {
        await admin.from("user_sessions").insert({
          user_id: userId,
          device_id: deviceId,
          ip_address: ip,
          user_agent: ua,
        });
      }
      return json({ status: "active" });
    }

    // ping: verifica se a sessão deste device ainda é a ativa
    const { data: mine } = await admin
      .from("user_sessions")
      .select("id, revoked_at, revoked_reason")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mine || mine.revoked_at) {
      return json({ status: "revoked", reason: mine?.revoked_reason || "unknown" });
    }

    await admin
      .from("user_sessions")
      .update({ last_seen_at: new Date().toISOString(), ip_address: ip, user_agent: ua })
      .eq("id", mine.id);

    return json({ status: "active" });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}