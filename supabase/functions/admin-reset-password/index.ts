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

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId: string = String(body.user_id || "");
    const newPassword: string = String(body.new_password || "");

    if (!targetUserId) return json({ error: "user_id obrigatório" }, 400);
    if (!newPassword || newPassword.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
    if (newPassword.length > 128) return json({ error: "Senha muito longa" }, 400);

    // Bloqueia redefinir senha de admin
    const { data: targetRole } = await admin
      .from("user_roles").select("role")
      .eq("user_id", targetUserId).eq("role", "admin").maybeSingle();
    if (targetRole) return json({ error: "Senha de administrador não pode ser redefinida por aqui" }, 403);

    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    const email = updated.user?.email || "";
    await admin.from("admin_credentials").upsert({
      user_id: targetUserId,
      email,
      password: newPassword,
    }, { onConflict: "user_id" });

    return json({ status: "ok" });
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