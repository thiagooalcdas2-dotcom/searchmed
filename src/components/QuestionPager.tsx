import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionCard, QuestionData, AnsweredState } from "@/components/QuestionCard";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mostra UMA questão por vez com painel lateral numerado para navegação direta.
 * Mantém o estado de acerto por questão para colorir os botões do painel.
 */
export const QuestionPager = ({
  questions,
  onAnswer,
  emptyMessage = "Nenhuma questão para exibir.",
  header,
}: {
  questions: QuestionData[];
  onAnswer?: (q: QuestionData, selected: string, correct: boolean, extra?: { openAnswer?: string; grade?: any }) => void;
  emptyMessage?: string;
  header?: React.ReactNode;
}) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnsweredState>>({});

  // Carrega tentativas anteriores do usuário para travar respostas já confirmadas
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !questions?.length) return;
      const ids = questions.map((q) => q.id);
      const { data } = await supabase
        .from("question_attempts")
        .select("question_id, selected_alternative, is_correct, created_at")
        .eq("user_id", uid)
        .in("question_id", ids)
        .order("created_at", { ascending: true });
      if (cancelled || !data) return;
      const map: Record<string, AnsweredState> = {};
      for (const row of data as any[]) {
        // mantém a primeira tentativa (resposta inicial bloqueada)
        if (!map[row.question_id]) {
          const q = questions.find((x) => x.id === row.question_id);
          const isOpen = q?.question_format === "open_ended";
          map[row.question_id] = {
            selected: row.selected_alternative,
            correct: !!row.is_correct,
            openAnswer: isOpen ? row.selected_alternative : undefined,
            grade: isOpen
              ? {
                  verdict: row.is_correct ? "correta" : "incorreta",
                  score: row.is_correct ? 1 : 0,
                  feedback: "Resposta enviada anteriormente. Veja o gabarito esperado abaixo.",
                }
              : null,
          };
        }
      }
      setAnswers((prev) => ({ ...map, ...prev }));
    })();
    return () => { cancelled = true; };
  }, [questions]);

  if (!questions || questions.length === 0) {
    return <div className="text-center py-16 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  const safeIndex = Math.min(index, questions.length - 1);
  const current = questions[safeIndex];

  const handle = async (selected: string, correct: boolean, extra?: { openAnswer?: string; grade?: any }) => {
    setAnswers((p) => ({
      ...p,
      [current.id]: { selected, correct, openAnswer: extra?.openAnswer, grade: extra?.grade ?? null },
    }));
    // Persiste a tentativa no banco para travar a resposta entre sessões/recargas.
    // Só insere se ainda não houver tentativa registrada para esta questão.
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (uid) {
        const { data: existing } = await supabase
          .from("question_attempts")
          .select("id")
          .eq("user_id", uid)
          .eq("question_id", current.id)
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("question_attempts").insert({
            user_id: uid,
            question_id: current.id,
            selected_alternative: selected.slice(0, 500),
            is_correct: correct,
          });
        }
      }
    } catch { /* silencioso */ }
    onAnswer?.(current, selected, correct, extra);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_220px] gap-6">
      <div>
        {header}
        <div className="text-xs text-muted-foreground mb-3">
          Questão {safeIndex + 1} de {questions.length}
        </div>
        <QuestionCard key={current.id} q={current} onAnswer={handle} answered={answers[current.id] || null} />
        <div className="flex justify-between mt-6">
          <Button variant="outline" disabled={safeIndex === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <Button
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={safeIndex >= questions.length - 1}
          >
            Próxima <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      <Card className="bg-card-elegant border-border p-4 h-fit lg:sticky lg:top-6 order-first lg:order-last">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Navegação</div>
        <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
          {questions.map((q, i) => {
            const a = answers[q.id];
            const st = a ? (a.correct ? "correct" : "wrong") : undefined;
            const isCurrent = i === safeIndex;
            return (
              <button
                key={q.id}
                onClick={() => setIndex(i)}
                className={`aspect-square rounded text-xs font-mono border transition ${
                  isCurrent
                    ? "border-primary ring-2 ring-primary/40"
                    : st === "correct"
                    ? "border-success bg-success/15 text-success"
                    : st === "wrong"
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success/60" /> Acertou</div>
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/60" /> Errou</div>
        </div>
      </Card>
    </div>
  );
};