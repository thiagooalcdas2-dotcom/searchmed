import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ReviewQueue = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("review_status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string, patch: any) => {
    setActing(id);
    const { error } = await supabase.from("questions").update({ ...patch, review_status: "approved" }).eq("id", id);
    setActing(null);
    if (error) return toast.error(error.message);
    toast.success("Aprovada");
    setItems((p) => p.filter((q) => q.id !== id));
  };

  const reject = async (id: string) => {
    setActing(id);
    const { error } = await supabase.from("questions").update({ review_status: "rejected" }).eq("id", id);
    setActing(null);
    if (error) return toast.error(error.message);
    toast.success("Rejeitada");
    setItems((p) => p.filter((q) => q.id !== id));
  };

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;
  if (items.length === 0) return <p className="text-muted-foreground">Nenhuma questão pendente. 🎉</p>;

  return (
    <div className="space-y-4">
      {items.map((q) => <ReviewItem key={q.id} q={q} onApprove={approve} onReject={reject} acting={acting === q.id} />)}
    </div>
  );
};

const ReviewItem = ({ q, onApprove, onReject, acting }: any) => {
  const [statement, setStatement] = useState(q.statement);
  const [correct, setCorrect] = useState(q.correct_alternative || "");
  const [explanation, setExplanation] = useState(q.explanation || "");
  const [discipline, setDiscipline] = useState(q.discipline || "");

  return (
    <Card className="p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{q.origin}</Badge>
        <Badge variant="outline">{q.course_year}</Badge>
        <Badge variant="outline">{q.difficulty}</Badge>
        <Badge>{q.question_format}</Badge>
        {q.reference_year && <Badge variant="outline">{q.reference_year}</Badge>}
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Matéria</label>
        <Input value={discipline} onChange={(e) => setDiscipline(e.target.value)} />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Enunciado</label>
        <Textarea rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </div>

      {q.question_format === "multiple_choice" && Array.isArray(q.alternatives) && (
        <div className="space-y-1 text-sm">
          {q.alternatives.map((a: any) => (
            <div key={a.key} className={`px-3 py-2 rounded border ${a.key === correct ? "border-primary bg-primary/5" : "border-border"}`}>
              <span className="font-mono mr-2">{a.key}.</span>{a.text}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground">Gabarito:</span>
            <Input value={correct} onChange={(e) => setCorrect(e.target.value.toUpperCase())} className="w-20" maxLength={1} />
          </div>
        </div>
      )}

      {q.question_format === "open_ended" && q.expected_answer && (
        <div className="text-sm bg-muted rounded p-3"><strong>Gabarito esperado:</strong> {q.expected_answer}</div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Explicação</label>
        <Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onApprove(q.id, { statement, correct_alternative: correct, explanation, discipline })}
          disabled={acting}
          className="bg-gradient-primary text-primary-foreground"
        >
          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-2" />Aprovar</>}
        </Button>
        <Button variant="outline" onClick={() => onReject(q.id)} disabled={acting}>
          <X className="h-4 w-4 mr-2" />Rejeitar
        </Button>
      </div>
    </Card>
  );
};