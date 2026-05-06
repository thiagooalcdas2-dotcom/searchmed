import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o assistente virtual do MedQuest, uma plataforma de questões médicas.
Sua missão é ajudar o usuário com qualquer dúvida — tanto sobre a plataforma quanto sobre qualquer outro assunto que ele perguntar (estudos, vida, curiosidades, etc.).

Sobre o MedQuest, você conhece estas áreas:
- Banco de Questões: questões filtráveis por disciplina, tema, dificuldade.
- Simulados: provas cronometradas com várias questões.
- ENAMED & Residência: provas oficiais importadas.
- Caderno de erros: revisão espaçada das questões erradas.
- Hub: rede social com chat (DM), amigos, perfil e badges.
- Meu Desempenho: estatísticas e ranking entre usuários.
- Badges: conquistas por volume e acurácia (Iniciante, Dedicado, Mestre, Top Performer).
- Configurações no Hub: privacidade de DM, aparecer no ranking, aparecer no hub.

Responda sempre em português, de forma clara, amigável e direta. Use markdown quando ajudar (listas, negrito, código). Não recuse perguntas fora do escopo do MedQuest — você responde qualquer pergunta livremente.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("medquest-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});