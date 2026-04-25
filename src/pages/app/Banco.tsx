import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard, QuestionData } from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { toast } from "sonner";

const Banco = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [filter, setFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });
  const [index, setIndex] = useState(0);

  const load = async () => {
    let q = supabase.from("questions").select("*").eq("review_status", "approved").limit(50);
    if (filter.year !== "geral") q = q.eq("course_year", filter.year as any);
    if (filter.difficulty !== "all") q = q.eq("difficulty", filter.difficulty as any);
    if (filter.discipline !== "all") q = q.eq("discipline", filter.discipline);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setQuestions((data || []) as any);
    setIndex(0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.year, filter.discipline, filter.difficulty]);

  const current = questions[index];

  const onAnswer = async (selected: string, correct: boolean) => {
    if (!current || !user) return;
    await supabase.from("question_attempts").insert({
      user_id: user.id, question_id: current.id, selected_alternative: selected, is_correct: correct,
    });
  };

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="font-display text-4xl mb-2">Banco de Questões</h1>
      <p className="text-muted-foreground mb-8">Selecione ano, matéria e dificuldade para começar.</p>

      <Card className="bg-card-elegant border-border p-6 mb-6">
        <CascadeFilter value={filter} onChange={setFilter} />
      </Card>

      {current ? (
        <>
          <div className="text-xs text-muted-foreground mb-3">Questão {index + 1} de {questions.length}</div>
          <QuestionCard q={current} onAnswer={onAnswer} />
          <div className="flex justify-between mt-6">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Anterior</Button>
            <Button onClick={() => setIndex(i => Math.min(i + 1, questions.length - 1))} disabled={index >= questions.length - 1}>Próxima</Button>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">Nenhuma questão encontrada com esses filtros.</div>
      )}
    </div>
  );
};

export default Banco;