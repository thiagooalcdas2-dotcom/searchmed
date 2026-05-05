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

    // Verifica se quem chamou é admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    console.log("admin-create-user body received:", JSON.stringify(body));
    const email: string = String(body.email || "").trim().toLowerCase();
    const password: string = String(body.password || "");
    const fullName: string | null = body.full_name ? String(body.full_name).trim() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: `E-mail inválido (recebido: "${email}")` }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
    }
    if (email.length > 255 || password.length > 128) {
      return json({ error: "Campos muito longos" }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // Garante role student (trigger handle_new_user já cria, mas reforça)
    if (created.user) {
      await admin.from("user_roles")
        .upsert({ user_id: created.user.id, role: "student" }, { onConflict: "user_id,role" });

      // Salva credencial em texto plano (apenas admin consegue ler via RLS)
      await admin.from("admin_credentials").upsert({
        user_id: created.user.id,
        email,
        password,
      }, { onConflict: "user_id" });
    }

    return json({ status: "ok", user_id: created.user?.id, email });
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