import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type QuestionData = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  correct_alternative: string;
  explanation: string;
  discipline: string;
  subtopic?: string | null;
  difficulty: string;
  origin: string;
  media_url?: string | null;
  media_caption?: string | null;
  is_ai_unofficial?: boolean;
  course_year?: string;
  question_format?: "multiple_choice" | "open_ended";
  expected_answer?: string | null;
};

const ORIGIN_LABEL: Record<string, string> = {
  internal: "Banco interno", enamed: "ENAMED",
  residencia_itajuba: "Itajubá", residencia_alfenas: "Alfenas",
  residencia_pouso_alegre: "Pouso Alegre", residencia_lavras: "Lavras",
  residencia_sp_usp: "SP · USP", residencia_sp_santa_casa: "SP · Santa Casa", residencia_sp_outros: "SP · Outros",
};

export const QuestionCard = ({ q, onAnswer, mode = "study" }: {
  q: QuestionData;
  onAnswer?: (selected: string, correct: boolean) => void;
  mode?: "study" | "exam";
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openAnswer, setOpenAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<{ verdict: string; score: number; feedback: string } | null>(null);

  const isOpen = q.question_format === "open_ended";

  const choose = (key: string) => {
    if (revealed) return;
    setSelected(key);
  };

  const confirm = () => {
    if (!selected) return;
    setRevealed(true);
    onAnswer?.(selected, selected === q.correct_alternative);
  };

  const submitOpen = async () => {
    if (!openAnswer.trim()) return;
    setGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-grade-open", {
        body: { question_id: q.id, answer: openAnswer },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGrade(data as any);
      setRevealed(true);
      onAnswer?.(openAnswer.slice(0, 500), (data as any).verdict === "correta");
    } catch (e: any) {
      toast.error(e.message || "Falha ao avaliar resposta");
    } finally {
      setGrading(false);
    }
  };

  return (
    <Card className="bg-card-elegant border-border p-6 md:p-8 shadow-soft">
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="border-primary/40 text-primary">{q.discipline}</Badge>
        {q.subtopic && <Badge variant="outline">{q.subtopic}</Badge>}
        <Badge variant="outline" className="border-gold/40 text-gold">{ORIGIN_LABEL[q.origin] || q.origin}</Badge>
        <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
        {isOpen && <Badge variant="outline" className="border-primary/40">Dissertativa</Badge>}
        {q.is_ai_unofficial && (
          <Badge variant="outline" className="border-destructive/50 text-destructive">IA — não oficial</Badge>
        )}
      </div>
      <p className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-line">{q.statement}</p>
      {q.media_url && (
        <figure className="mb-6">
          <img src={q.media_url} alt={q.media_caption || "Mídia da questão"} className="rounded-lg border border-border w-full" />
          {q.media_caption && <figcaption className="text-xs text-muted-foreground mt-2">{q.media_caption}</figcaption>}
        </figure>
      )}
      {isOpen ? (
        <div className="space-y-3">
          <Textarea
            value={openAnswer}
            onChange={(e) => setOpenAnswer(e.target.value)}
            disabled={revealed}
            rows={5}
            placeholder="Escreva sua resposta dissertativa…"
          />
          {!revealed && (
            <Button onClick={submitOpen} disabled={grading || !openAnswer.trim()} className="bg-gradient-primary text-primary-foreground">
              {grading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Avaliando…</> : "Enviar resposta"}
            </Button>
          )}
          {revealed && grade && (
            <div className={`p-5 rounded-lg border ${
              grade.verdict === "correta" ? "border-success bg-success/10" :
              grade.verdict === "parcial" ? "border-gold bg-gold/10" :
              "border-destructive bg-destructive/10"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-lg capitalize">{grade.verdict}</span>
                <span className="text-sm text-muted-foreground">Nota: {Math.round(grade.score * 100)}%</span>
              </div>
              <p className="text-sm leading-relaxed">{grade.feedback}</p>
            </div>
          )}
          {revealed && mode === "study" && q.expected_answer && (
            <div className="p-5 rounded-lg border border-primary/30 bg-primary/5">
              <div className="text-xs uppercase tracking-wider text-primary mb-2">Gabarito esperado</div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{q.expected_answer}</p>
            </div>
          )}
        </div>
      ) : (
      <div className="space-y-2">
        {q.alternatives.map((a) => {
          const isSelected = selected === a.key;
          const isCorrect = a.key === q.correct_alternative;
          let cls = "border-border hover:border-primary/50 hover:bg-secondary/40";
          if (revealed) {
            if (isCorrect) cls = "border-success bg-success/10";
            else if (isSelected) cls = "border-destructive bg-destructive/10";
            else cls = "border-border opacity-60";
          } else if (isSelected) cls = "border-primary bg-primary/10";
          return (
            <button key={a.key} onClick={() => choose(a.key)} disabled={revealed}
              className={`w-full text-left p-4 rounded-lg border transition-all flex gap-3 ${cls}`}>
              <span className="font-mono font-semibold text-primary">{a.key}</span>
              <span className="flex-1">{a.text}</span>
              {revealed && isCorrect && <Check className="h-5 w-5 text-success shrink-0" />}
              {revealed && isSelected && !isCorrect && <X className="h-5 w-5 text-destructive shrink-0" />}
            </button>
          );
        })}
      </div>
      )}
      {!isOpen && !revealed && (
        <Button onClick={confirm} disabled={!selected} className="mt-6 bg-gradient-primary text-primary-foreground">
          Confirmar resposta
        </Button>
      )}
      {!isOpen && revealed && mode === "study" && (
        <div className="mt-6 p-5 rounded-lg border border-primary/30 bg-primary/5">
          <div className="text-xs uppercase tracking-wider text-primary mb-2">Comentário</div>
          <p className="text-sm leading-relaxed">{q.explanation}</p>
        </div>
      )}
    </Card>
  );
};