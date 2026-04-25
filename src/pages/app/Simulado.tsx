import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuestionCard, QuestionData } from "@/components/QuestionCard";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Simulado = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(5);
  const [filter, setFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const start = async () => {
    let q = supabase.from("questions").select("*").eq("review_status", "approved");
    if (filter.year !== "geral") q = q.eq("course_year", filter.year as any);
    if (filter.discipline !== "all") q = q.eq("discipline", filter.discipline);
    if (filter.difficulty !== "all") q = q.eq("difficulty", filter.difficulty as any);
    const { data } = await q;
    if (!data || data.length === 0) { toast.error("Sem questões para esse filtro."); return; }
    const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, count);
    setQuestions(shuffled as any);
    setAnswers({});
    setDone(false);
  };

  const onAnswer = async (id: string, selected: string, correct: boolean) => {
    setAnswers(prev => ({ ...prev, [id]: correct }));
    if (user) {
      await supabase.from("question_attempts").insert({
        user_id: user.id, question_id: id, selected_alternative: selected, is_correct: correct,
      });
    }
  };

  const finish = async () => {
    setDone(true);
    const correct = Object.values(answers).filter(Boolean).length;
    if (user) {
      await supabase.from("simulados").insert({
        user_id: user.id, title: `Simulado · ${new Date().toLocaleDateString()}`,
        question_ids: questions.map(q => q.id), total_questions: questions.length,
        correct_count: correct, score: (correct / questions.length) * 100, finished_at: new Date().toISOString(),
      });
    }
    toast.success(`Simulado concluído: ${correct}/${questions.length}`);
  };

  if (questions.length === 0) {
    return (
      <div className="container max-w-2xl py-12">
        <h1 className="font-display text-4xl mb-2">Montar simulado</h1>
        <p className="text-muted-foreground mb-8">Escolha ano → matéria → dificuldade.</p>
        <Card className="bg-card-elegant border-border p-6 space-y-4">
          <CascadeFilter value={filter} onChange={setFilter} />
          <div>
            <Label>Número de questões</Label>
            <Input type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))} />
          </div>
          <Button onClick={start} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">Iniciar</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12 space-y-6">
      <h1 className="font-display text-3xl">Simulado em andamento</h1>
      {questions.map((q, i) => (
        <div key={q.id}>
          <div className="text-xs text-muted-foreground mb-2">Questão {i + 1} de {questions.length}</div>
          <QuestionCard q={q} onAnswer={(s, c) => onAnswer(q.id, s, c)} />
        </div>
      ))}
      {!done && (
        <Button onClick={finish} className="w-full bg-gradient-primary text-primary-foreground shadow-glow" size="lg">
          Encerrar simulado · {Object.keys(answers).length}/{questions.length} respondidas
        </Button>
      )}
      {done && (
        <Card className="bg-card-elegant border-primary/40 p-6 text-center">
          <div className="font-display text-3xl text-gradient">
            {Object.values(answers).filter(Boolean).length} / {questions.length}
          </div>
          <p className="text-muted-foreground mt-2">Resultado salvo no seu desempenho.</p>
        </Card>
      )}
    </div>
  );
};

export default Simulado;