import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionData } from "@/components/QuestionCard";
import { QuestionPager } from "@/components/QuestionPager";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { toast } from "sonner";
import { enqueueReviewCard } from "@/lib/reviewQueue";

const Banco = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [filter, setFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });

  const load = async () => {
    let q = supabase.from("questions").select("*").eq("review_status", "approved").limit(120);
    if (filter.year !== "geral") q = q.eq("course_year", filter.year as any);
    if (filter.difficulty !== "all") q = q.eq("difficulty", filter.difficulty as any);
    if (filter.discipline !== "all") q = q.eq("discipline", filter.discipline);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    // Diversifica: embaralha e prioriza as que o usuário menos respondeu
    let pool = (data || []) as any[];
    if (user && pool.length > 0) {
      const ids = pool.map((p: any) => p.id);
      const { data: att } = await supabase
        .from("question_attempts")
        .select("question_id")
        .eq("user_id", user.id)
        .in("question_id", ids);
      const seen = new Map<string, number>();
      (att || []).forEach((a: any) => seen.set(a.question_id, (seen.get(a.question_id) || 0) + 1));
      pool = pool
        .map(p => ({ p, s: (seen.get(p.id) || 0), r: Math.random() }))
        .sort((a, b) => a.s - b.s || a.r - b.r)
        .map(x => x.p)
        .slice(0, 50);
    } else {
      pool = pool.sort(() => Math.random() - 0.5).slice(0, 50);
    }
    setQuestions(pool as any);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.year, filter.discipline, filter.difficulty, user?.id]);

  const onAnswer = async (q: QuestionData, selected: string, correct: boolean) => {
    if (!user) return;
    await supabase.from("question_attempts").insert({
      user_id: user.id, question_id: q.id, selected_alternative: selected, is_correct: correct,
    });
    if (!correct) {
      await enqueueReviewCard(user.id, q.id, "wrong_answer");
    }
  };

  return (
    <div className="container max-w-6xl py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl mb-2">Banco de Questões</h1>
      <p className="text-muted-foreground mb-8">Selecione ano, matéria e dificuldade para começar.</p>

      <Card className="bg-card-elegant border-border p-6 mb-6">
        <CascadeFilter value={filter} onChange={setFilter} />
      </Card>

      <QuestionPager
        key={`${filter.year}-${filter.discipline}-${filter.difficulty}`}
        questions={questions}
        onAnswer={onAnswer}
        emptyMessage="Nenhuma questão encontrada com esses filtros."
      />
    </div>
  );
};

export default Banco;