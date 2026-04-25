import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORIGIN_LABELS: Record<string, string> = {
  enamed: "ENAMED",
  residencia_itajuba: "Residência - Itajubá (Sul de Minas)",
  residencia_alfenas: "Residência - Alfenas (Sul de Minas)",
  residencia_pouso_alegre: "Residência - Pouso Alegre / Univás",
  residencia_lavras: "Residência - Lavras / UFLA",
  residencia_sp_usp: "Residência - SP estilo USP",
  residencia_sp_santa_casa: "Residência - SP Santa Casa",
  residencia_sp_outros: "Residência - SP outros hospitais de ensino",
  internal: "Banco interno",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!);
    const body = await req.json();
    const mode: "generate" | "transform" = body.mode || "generate";
    const origin: string = body.origin || "enamed";
    const discipline: string | undefined = body.discipline;
    const courseYear: string = body.course_year || "residencia";
    const difficultyIn: string | undefined = body.difficulty;
    const count: number = Math.min(Math.max(Number(body.count) || 3, 1), 10);
    const clinicalCase: string | undefined = body.clinicalCase;

    // Fetch base examples (questões aprovadas da banca)
    let baseExamples: any[] = [];
    if (mode === "generate") {
      const { data: ex } = await admin
        .from("questions")
        .select("statement, alternatives, correct_alternative, explanation, discipline, difficulty")
        .eq("origin", origin)
        .eq("review_status", "approved")
        .limit(5);
      baseExamples = ex || [];
    }

    const originLabel = ORIGIN_LABELS[origin] || origin;
    const systemPrompt = `Você é um professor de medicina especialista em elaboração de questões para ENAMED e residência médica.
REGRAS RÍGIDAS:
- Crie questões ORIGINAIS, sem copiar texto de provas reais protegidas.
- Apenas UMA alternativa correta. Distratores plausíveis (não absurdos).
- Comentário deve explicar o raciocínio clínico e por que cada alternativa errada está errada brevemente.
- Conteúdo cientificamente correto e atualizado.
- CONTROLE DE TAMANHO: as alternativas devem ter comprimentos parecidos. NÃO faça a correta significativamente mais longa que as demais. Mantenha paralelismo gramatical.
- VARIE A POSIÇÃO da alternativa correta (não use sempre a mesma letra).
- Estilo da banca alvo: ${originLabel}.
- Idioma: português brasileiro.
- Responda APENAS JSON válido conforme o schema solicitado, sem markdown.`;

    const difficultyHint = difficultyIn ? `Dificuldade alvo: ${difficultyIn}.` : "";
    let userPrompt = "";
    if (mode === "generate") {
      userPrompt = `Gere ${count} questão(ões) de múltipla escolha (5 alternativas A-E) inspiradas no estilo da banca ${originLabel}${discipline ? `, na disciplina: ${discipline}` : ""}. ${difficultyHint}
Use estes exemplos APENAS como referência de estilo e padrão (não copie):
${JSON.stringify(baseExamples).slice(0, 4000)}

Responda no formato JSON:
{ "questions": [ { "statement": "...", "alternatives": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}], "correct_alternative":"B", "explanation":"...", "discipline":"...", "subtopic":"...", "difficulty":"easy|medium|hard", "confidence": 0.0-1.0, "alt_length_balanced": true } ] }`;
    } else {
      userPrompt = `Transforme o caso clínico abaixo em UMA questão de múltipla escolha (5 alternativas) no estilo da banca ${originLabel}. ${difficultyHint}
CASO: """${clinicalCase || ""}"""
Mesmo formato JSON do schema acima, "questions" como array com 1 item.`;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    let parsed: any;
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}"); }
    catch { parsed = {}; }
    const generated: any[] = parsed.questions || [];

    // Auto-validação: balanceamento de comprimento + 1 correta
    const validated = generated.map((q) => {
      const alts = q.alternatives || [];
      const lens = alts.map((a: any) => (a.text || "").length);
      const correct = alts.find((a: any) => a.key === q.correct_alternative);
      const correctLen = correct ? (correct.text || "").length : 0;
      const maxLen = Math.max(...lens, 1);
      const lengthBias = correctLen >= maxLen && (correctLen - (lens.filter((l: number) => l !== correctLen)[0] || 0)) > 30;
      const hasOneCorrect = alts.filter((a: any) => a.key === q.correct_alternative).length === 1;
      const confidence = Math.max(0, Math.min(1, Number(q.confidence) || 0.7)) - (lengthBias ? 0.25 : 0);
      const needsReview = lengthBias || !hasOneCorrect || confidence < 0.6;
      return { q, confidence: Math.max(0, confidence), needsReview, lengthBias, hasOneCorrect };
    });

    const inserted: any[] = [];
    for (const v of validated) {
      const { q, confidence, needsReview } = v;
      if (!q.statement || !q.alternatives) continue;
      const { data, error } = await admin.from("questions").insert({
        statement: q.statement,
        alternatives: q.alternatives,
        correct_alternative: q.correct_alternative,
        explanation: q.explanation || "",
        discipline: q.discipline || discipline || "Geral",
        subtopic: q.subtopic || null,
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : (difficultyIn && ["easy","medium","hard"].includes(difficultyIn) ? difficultyIn : "medium"),
        origin,
        course_year: courseYear,
        is_ai_unofficial: true,
        tags: [],
        review_status: "pending_review",
        ai_generated: true,
        ai_confidence: confidence,
        created_by: userId,
      }).select().single();
      if (!error && data) inserted.push({ ...data, _meta: { needsReview, confidence } });
    }

    return new Response(JSON.stringify({ inserted, count: inserted.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});