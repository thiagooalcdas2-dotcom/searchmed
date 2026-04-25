import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const questionId: string = body.question_id;
    const userAnswer: string = (body.answer || "").trim();
    if (!questionId || !userAnswer) {
      return new Response(JSON.stringify({ error: "question_id e answer são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!);
    const { data: q } = await admin.from("questions")
      .select("statement, expected_answer, explanation, discipline")
      .eq("id", questionId).maybeSingle();
    if (!q) {
      return new Response(JSON.stringify({ error: "Questão não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um professor de medicina avaliando uma resposta dissertativa.
Compare a resposta do aluno com o gabarito esperado.
Classifique em: "correta", "parcial" ou "incorreta".
Dê um feedback CURTO (máx 3 frases) em português, dizendo o que está certo e o que faltou/errou.
Responda APENAS com o tool call estruturado.`;

    const userPrompt = `Disciplina: ${q.discipline}
Enunciado: ${q.statement}
Gabarito esperado: ${q.expected_answer || q.explanation}
Resposta do aluno: ${userAnswer}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "grade_answer",
            description: "Avalia a resposta dissertativa.",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["correta", "parcial", "incorreta"] },
                score: { type: "number", description: "0 a 1" },
                feedback: { type: "string" },
              },
              required: ["verdict", "score", "feedback"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "grade_answer" } },
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try { parsed = JSON.parse(tc?.function?.arguments || "{}"); } catch { parsed = {}; }

    const verdict = ["correta", "parcial", "incorreta"].includes(parsed.verdict) ? parsed.verdict : "incorreta";
    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
    const feedback = String(parsed.feedback || "Sem feedback.");

    // Registra tentativa (is_correct = correta; selected_alternative armazena a resposta livre truncada)
    await admin.from("question_attempts").insert({
      user_id: userRes.user.id,
      question_id: questionId,
      selected_alternative: userAnswer.slice(0, 500),
      is_correct: verdict === "correta",
    });

    return new Response(JSON.stringify({ verdict, score, feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});