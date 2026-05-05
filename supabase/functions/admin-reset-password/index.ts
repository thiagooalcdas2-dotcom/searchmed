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
    const newPassword: string = body.new_password ? String(body.new_password) : "";
    const newEmailRaw: string = body.new_email ? String(body.new_email).trim() : "";
    const newFullName: string | null = body.new_full_name !== undefined
      ? (body.new_full_name === null ? null : String(body.new_full_name).trim())
      : undefined as any;

    if (!targetUserId) return json({ error: "user_id obrigatório" }, 400);
    if (!newPassword && !newEmailRaw && newFullName === undefined) {
      return json({ error: "Nada para atualizar" }, 400);
    }
    if (newPassword && (newPassword.length < 1 || newPassword.length > 128)) {
      return json({ error: "Senha inválida" }, 400);
    }
    if (newEmailRaw && newEmailRaw.length > 255) return json({ error: "Login muito longo" }, 400);

    // Bloqueia alterar conta de admin
    const { data: targetRole } = await admin
      .from("user_roles").select("role")
      .eq("user_id", targetUserId).eq("role", "admin").maybeSingle();
    if (targetRole) return json({ error: "Conta de administrador não pode ser alterada por aqui" }, 403);

    // Normaliza login: aceita username ou e-mail
    const newEmail = newEmailRaw
      ? (newEmailRaw.includes("@")
          ? newEmailRaw.toLowerCase()
          : `${newEmailRaw.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@users.local`)
      : "";

    const updatePayload: Record<string, unknown> = {};
    if (newPassword) updatePayload.password = newPassword;
    if (newEmail) { updatePayload.email = newEmail; updatePayload.email_confirm = true; }
    if (newFullName !== undefined) updatePayload.user_metadata = { full_name: newFullName };

    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(targetUserId, updatePayload as any);
    if (updErr) return json({ error: updErr.message }, 400);

    const finalEmail = updated.user?.email || newEmail || "";
    // Atualiza credenciais armazenadas
    const credPatch: Record<string, unknown> = { user_id: targetUserId, email: finalEmail };
    if (newPassword) credPatch.password = newPassword;
    await admin.from("admin_credentials").upsert(credPatch, { onConflict: "user_id" });

    // Atualiza profile.full_name
    if (newFullName !== undefined) {
      await admin.from("profiles").update({ full_name: newFullName }).eq("id", targetUserId);
    }

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