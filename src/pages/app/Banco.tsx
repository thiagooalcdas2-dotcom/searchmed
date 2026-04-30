import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard, QuestionData } from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { toast } from "sonner";
import { enqueueReviewCard } from "@/lib/reviewQueue";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Banco = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [filter, setFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });
  const [index, setIndex] = useState(0);
  // status local por questão para colorir painel: 'correct' | 'wrong' | undefined
  const [statuses, setStatuses] = useState<Record<string, "correct" | "wrong">>({});

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
    setIndex(0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.year, filter.discipline, filter.difficulty, user?.id]);

  const current = questions[index];

  const onAnswer = async (selected: string, correct: boolean) => {
    if (!current || !user) return;
    setStatuses(prev => ({ ...prev, [current.id]: correct ? "correct" : "wrong" }));
    await supabase.from("question_attempts").insert({
      user_id: user.id, question_id: current.id, selected_alternative: selected, is_correct: correct,
    });
    if (!correct) {
      await enqueueReviewCard(user.id, current.id, "wrong_answer");
    }
  };

  return (
    <div className="container max-w-6xl py-8 md:py-12">
      <h1 className="font-display text-3xl md:text-4xl mb-2">Banco de Questões</h1>
      <p className="text-muted-foreground mb-8">Selecione ano, matéria e dificuldade para começar.</p>

      <Card className="bg-card-elegant border-border p-6 mb-6">
        <CascadeFilter value={filter} onChange={setFilter} />
      </Card>

      {current ? (
        <div className="grid lg:grid-cols-[1fr_220px] gap-6">
          <div>
            <div className="text-xs text-muted-foreground mb-3">Questão {index + 1} de {questions.length}</div>
            {/* key força reset interno do QuestionCard ao trocar de questão */}
            <QuestionCard key={current.id} q={current} onAnswer={onAnswer} />
            <div className="flex justify-between mt-6">
              <Button variant="outline" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button onClick={() => setIndex(i => Math.min(i + 1, questions.length - 1))} disabled={index >= questions.length - 1}>
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
          <Card className="bg-card-elegant border-border p-4 h-fit lg:sticky lg:top-6 order-first lg:order-last">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Navegação</div>
            <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const st = statuses[q.id];
                const isCurrent = i === index;
                return (
                  <button
                    key={q.id}
                    onClick={() => setIndex(i)}
                    className={`aspect-square rounded text-xs font-mono border transition ${
                      isCurrent ? "border-primary ring-2 ring-primary/40" :
                      st === "correct" ? "border-success bg-success/15 text-success" :
                      st === "wrong" ? "border-destructive bg-destructive/15 text-destructive" :
                      "border-border hover:border-primary/40"
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
      ) : (
        <div className="text-center py-20 text-muted-foreground">Nenhuma questão encontrada com esses filtros.</div>
      )}
    </div>
  );
};

export default Banco;