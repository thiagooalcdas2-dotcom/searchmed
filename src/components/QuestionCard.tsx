import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

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

  const choose = (key: string) => {
    if (revealed) return;
    setSelected(key);
  };

  const confirm = () => {
    if (!selected) return;
    setRevealed(true);
    onAnswer?.(selected, selected === q.correct_alternative);
  };

  return (
    <Card className="bg-card-elegant border-border p-6 md:p-8 shadow-soft">
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="border-primary/40 text-primary">{q.discipline}</Badge>
        {q.subtopic && <Badge variant="outline">{q.subtopic}</Badge>}
        <Badge variant="outline" className="border-gold/40 text-gold">{ORIGIN_LABEL[q.origin] || q.origin}</Badge>
        <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
      </div>
      <p className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-line">{q.statement}</p>
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
      {!revealed && (
        <Button onClick={confirm} disabled={!selected} className="mt-6 bg-gradient-primary text-primary-foreground">
          Confirmar resposta
        </Button>
      )}
      {revealed && mode === "study" && (
        <div className="mt-6 p-5 rounded-lg border border-primary/30 bg-primary/5">
          <div className="text-xs uppercase tracking-wider text-primary mb-2">Comentário</div>
          <p className="text-sm leading-relaxed">{q.explanation}</p>
        </div>
      )}
    </Card>
  );
};