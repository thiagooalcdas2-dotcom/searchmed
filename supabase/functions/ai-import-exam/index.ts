import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// origin → exam_board (mantém alinhado com os enums do banco)
const ORIGIN_TO_BOARD: Record<string, string> = {
  residencia_itajuba: "mg_itajuba",
  residencia_alfenas: "mg_alfenas",
  residencia_pouso_alegre: "mg_pouso_alegre",
  residencia_lavras: "mg_lavras",
  residencia_sp_usp: "sp_usp",
  residencia_sp_santa_casa: "sp_santa_casa",
  residencia_sp_outros: "sp_outros",
  enamed: "enamed",
  internal: "none",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Auth + admin gate
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL!, ANON!, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const {
      text,                 // texto colado (opcional)
      file_paths = [],      // array de paths no bucket exam-imports (PDFs/imagens)
      origin = "internal",
      course_year = "residencia",
      reference_year = null,
      default_discipline = null,
    } = body || {};

    if (!text && (!Array.isArray(file_paths) || file_paths.length === 0)) {
      return new Response(JSON.stringify({ error: "Envie texto ou arquivos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Monta o conteúdo multimodal: texto + imagens (data URLs assinados)
    const contentParts: any[] = [];
    if (text && typeof text === "string") {
      contentParts.push({ type: "text", text: `Texto da prova:\n\n${text}` });
    }

    for (const path of file_paths) {
      const { data: file, error: dlErr } = await admin.storage.from("exam-imports").download(path);
      if (dlErr || !file) { console.error("download fail", path, dlErr); continue; }
      const buf = new Uint8Array(await file.arrayBuffer());
      // base64 em chunks pra evitar stack overflow
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
      }
      const b64 = btoa(binary);
      const lower = path.toLowerCase();
      const mime = lower.endsWith(".pdf") ? "application/pdf"
        : lower.endsWith(".png") ? "image/png"
        : lower.endsWith(".webp") ? "image/webp"
        : "image/jpeg";
      contentParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
    }

    const systemPrompt = `Você é um extrator de questões de provas de medicina (residência e graduação).
REGRAS:
- Leia o material (texto, PDFs e/ou imagens/scans) e extraia TODAS as questões identificáveis.
- Para múltipla escolha: capture enunciado completo, alternativas A-E (use a letra exata da prova) e o gabarito quando indicado; se o gabarito não estiver no material, deixe correct_alternative vazio e explique no campo explanation.
- Para dissertativa: capture enunciado e, se houver, a resposta esperada (expected_answer).
- Preserve dados clínicos, valores laboratoriais e unidades EXATAMENTE como no original.
- NÃO invente questões; só extraia o que está no material.
- Idioma: português brasileiro. Responda APENAS JSON válido, sem markdown.`;

    const userPrompt = `Extraia as questões e responda neste schema JSON:
{
  "questions": [
    {
      "format": "multiple_choice" | "open_ended",
      "discipline": "...",                // tente inferir (Clínica médica, Cirurgia, etc.)
      "subtopic": "...",                  // opcional
      "difficulty": "easy" | "medium" | "hard",
      "statement": "...",
      "alternatives": [{"key":"A","text":"..."}],   // só MCQ
      "correct_alternative": "A|B|C|D|E|",          // vazio se não houver gabarito
      "expected_answer": "...",                      // só dissertativa
      "explanation": "..."                           // breve; pode ficar vazio
    }
  ]
}
Origem desta prova: ${origin}. Ano de referência: ${reference_year ?? "desconhecido"}.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // multimodal + contexto grande
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts.length ? contentParts.concat([{ type: "text", text: userPrompt }]) : userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Aguarde alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }
    const extracted: any[] = parsed.questions || [];

    const board = ORIGIN_TO_BOARD[origin] ?? "none";
    let inserted = 0;
    const errors: string[] = [];

    for (const q of extracted) {
      if (!q?.statement) continue;
      const isOpen = q.format === "open_ended";
      const { error } = await admin.from("questions").insert({
        statement: q.statement,
        alternatives: isOpen ? [] : (q.alternatives || []),
        correct_alternative: isOpen ? "" : (q.correct_alternative || ""),
        explanation: q.explanation || "",
        expected_answer: isOpen ? (q.expected_answer || "") : null,
        discipline: q.discipline || default_discipline || "Geral",
        subtopic: q.subtopic || null,
        difficulty: ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : "medium",
        course_year,
        question_format: isOpen ? "open_ended" : "multiple_choice",
        origin,
        exam_board: board,
        reference_year,
        is_ai_unofficial: false,         // veio de prova oficial
        ai_generated: false,             // foi extraída, não gerada
        review_status: "pending_review", // sempre revisar antes de publicar
        tags: ["import", origin],
        created_by: userRes.user.id,
      });
      if (error) errors.push(error.message);
      else inserted++;
    }

    return new Response(JSON.stringify({ inserted, total_extracted: extracted.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});