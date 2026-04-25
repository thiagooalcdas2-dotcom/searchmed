import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Distribuição alvo: ano → matérias
const YEAR_DISCIPLINES: Record<string, string[]> = {
  ano_1: ["Bioquímica", "Anatomia humana", "Histologia", "Biologia celular e molecular", "Embriologia", "Psicologia"],
  ano_2: ["Fisiologia", "Microbiologia e parasitologia", "Imunologia", "Bioética e ética médica"],
  ano_3: ["Patologia", "Farmacologia", "Epidemiologia"],
  ano_4: ["Clínica médica", "Pediatria", "Ginecologia e obstetrícia"],
  ano_5: ["Cirurgia", "Ortopedia e traumatologia", "Dermatologia", "Oftalmologia", "Otorrinolaringologia"],
  ano_6: ["Clínica médica", "Cirurgia", "Pediatria", "Ginecologia e obstetrícia", "Psiquiatria"],
  residencia: [
    "Clínica médica", "Cirurgia", "Pediatria", "Ginecologia e obstetrícia",
    "Psiquiatria", "Ortopedia e traumatologia", "Dermatologia", "Oftalmologia",
    "Otorrinolaringologia", "Epidemiologia",
  ],
};

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const FORMATS = ["multiple_choice", "open_ended"] as const;

const ORIGIN_FOR_YEAR = (year: string) => year === "residencia" ? "enamed" : "internal";

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

    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    // Lote pequeno por chamada para respeitar rate-limits e manter resposta < 60s.
    const batchSize: number = Math.min(Math.max(Number(body.batch) || 10, 1), 25);
    const year: string | undefined = body.course_year;
    const discipline: string | undefined = body.discipline;

    // Sorteia (ano, matéria, dificuldade, formato) para o lote
    const tasks: { year: string; discipline: string; difficulty: string; format: string }[] = [];
    const years = year ? [year] : Object.keys(YEAR_DISCIPLINES);
    for (let i = 0; i < batchSize; i++) {
      const y = years[Math.floor(Math.random() * years.length)];
      const disciplines = discipline ? [discipline] : YEAR_DISCIPLINES[y];
      const d = disciplines[Math.floor(Math.random() * disciplines.length)];
      const diff = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
      // 80% MCQ, 20% dissertativa
      const fmt = Math.random() < 0.2 ? FORMATS[1] : FORMATS[0];
      tasks.push({ year: y, discipline: d, difficulty: diff, format: fmt });
    }

    const systemPrompt = `Você é um professor de medicina criando questões originais para estudo.
REGRAS:
- Conteúdo cientificamente correto e atualizado (diretrizes brasileiras quando aplicável).
- Questões ORIGINAIS (não copie nada de provas reais).
- Para múltipla escolha: 5 alternativas (A-E), apenas 1 correta, distratores plausíveis.
- Alternativas com tamanhos parecidos; varie a posição da correta.
- Para dissertativa: forneça gabarito esperado (3-6 linhas) cobrindo os pontos-chave.
- Idioma: português brasileiro. Responda APENAS JSON válido, sem markdown.`;

    const userPrompt = `Gere ${tasks.length} questões com este plano (uma por item, na ordem):
${tasks.map((t, i) => `${i + 1}. ano=${t.year} | matéria=${t.discipline} | dificuldade=${t.difficulty} | formato=${t.format}`).join("\n")}

Schema JSON:
{
  "questions": [
    {
      "format": "multiple_choice" | "open_ended",
      "course_year": "ano_1|ano_2|ano_3|ano_4|ano_5|ano_6|residencia",
      "discipline": "...",
      "difficulty": "easy|medium|hard",
      "statement": "...",
      "alternatives": [{"key":"A","text":"..."}, ...],   // apenas para multiple_choice
      "correct_alternative": "A|B|C|D|E",                 // apenas para multiple_choice
      "expected_answer": "...",                           // apenas para open_ended
      "explanation": "...",
      "subtopic": "..."
    }
  ]
}`;

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
    const generated: any[] = parsed.questions || [];

    let inserted = 0;
    for (let i = 0; i < generated.length; i++) {
      const q = generated[i];
      const planned = tasks[i] || tasks[0];
      if (!q?.statement) continue;
      const isOpen = q.format === "open_ended";
      const courseYear = ["ano_1","ano_2","ano_3","ano_4","ano_5","ano_6","residencia","geral"].includes(q.course_year) ? q.course_year : planned.year;
      const difficulty = ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : planned.difficulty;

      const { error } = await admin.from("questions").insert({
        statement: q.statement,
        alternatives: isOpen ? [] : (q.alternatives || []),
        correct_alternative: isOpen ? "" : (q.correct_alternative || ""),
        explanation: q.explanation || "",
        expected_answer: isOpen ? (q.expected_answer || "") : null,
        discipline: q.discipline || planned.discipline,
        subtopic: q.subtopic || null,
        difficulty,
        course_year: courseYear,
        question_format: isOpen ? "open_ended" : "multiple_choice",
        origin: ORIGIN_FOR_YEAR(courseYear),
        is_ai_unofficial: true,
        ai_generated: true,
        ai_confidence: 0.7,
        review_status: "approved", // entra direto, mas sempre marcada como IA — não oficial
        tags: ["ia", "bulk-seed"],
        created_by: userRes.user.id,
      });
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ inserted, planned: tasks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});