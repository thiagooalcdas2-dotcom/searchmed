import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard, QuestionData } from "@/components/QuestionCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ORIGINS = [
  { v: "all", l: "Todas as origens" },
  { v: "internal", l: "Banco interno" },
  { v: "enamed", l: "ENAMED" },
  { v: "residencia_itajuba", l: "Residência Itajubá" },
  { v: "residencia_alfenas", l: "Residência Alfenas" },
  { v: "residencia_pouso_alegre", l: "Residência Pouso Alegre" },
  { v: "residencia_lavras", l: "Residência Lavras" },
  { v: "residencia_sp_usp", l: "SP · USP" },
  { v: "residencia_sp_santa_casa", l: "SP · Santa Casa" },
  { v: "residencia_sp_outros", l: "SP · Outros" },
];
const DIFFS = [{ v: "all", l: "Todas dificuldades" }, { v: "easy", l: "Fácil" }, { v: "medium", l: "Médio" }, { v: "hard", l: "Difícil" }];

const Banco = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [origin, setOrigin] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [discipline, setDiscipline] = useState("all");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  const load = async () => {
    let q = supabase.from("questions").select("*").eq("review_status", "approved").limit(50);
    if (origin !== "all") q = q.eq("origin", origin as any);
    if (difficulty !== "all") q = q.eq("difficulty", difficulty as any);
    if (discipline !== "all") q = q.eq("discipline", discipline);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setQuestions((data || []) as any);
    setIndex(0);
  };

  useEffect(() => {
    supabase.from("questions").select("discipline").eq("review_status", "approved").then(({ data }) => {
      const ds = Array.from(new Set((data || []).map((d: any) => d.discipline))).sort();
      setDisciplines(ds);
    });
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [origin, difficulty, discipline]);

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
      <p className="text-muted-foreground mb-8">Filtre, responda e veja o comentário imediatamente.</p>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={discipline} onValueChange={setDiscipline}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as disciplinas</SelectItem>
            {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{DIFFS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

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