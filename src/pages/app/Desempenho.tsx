import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";

const Desempenho = () => {
  const { user } = useAuth();
  const [byDiscipline, setByDiscipline] = useState<{ name: string; correct: number; total: number }[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("question_attempts")
        .select("is_correct, questions(discipline)")
        .eq("user_id", user.id);
      const att = (data || []) as any[];
      const map = new Map<string, { c: number; t: number }>();
      let c = 0;
      att.forEach(a => {
        const d = a.questions?.discipline || "Outros";
        const e = map.get(d) || { c: 0, t: 0 };
        e.t += 1; if (a.is_correct) { e.c += 1; c += 1; }
        map.set(d, e);
      });
      setOverall({ total: att.length, correct: c });
      setByDiscipline([...map.entries()].map(([name, v]) => ({ name, correct: v.c, total: v.t })));
    })();
  }, [user]);

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="font-display text-4xl mb-2">Meu Desempenho</h1>
      <p className="text-muted-foreground mb-8">Onde você acerta, onde precisa estudar.</p>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-card-elegant border-border p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total respondido</div>
          <div className="font-display text-4xl mt-2">{overall.total}</div>
        </Card>
        <Card className="bg-card-elegant border-border p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Aproveitamento</div>
          <div className="font-display text-4xl mt-2 text-gradient">
            {overall.total ? Math.round((overall.correct / overall.total) * 100) : 0}%
          </div>
        </Card>
      </div>

      <Card className="bg-card-elegant border-border p-6">
        <h2 className="font-display text-xl mb-4">Por disciplina</h2>
        {byDiscipline.length === 0 && <p className="text-sm text-muted-foreground">Responda algumas questões para ver suas estatísticas.</p>}
        <div className="space-y-3">
          {byDiscipline.map(d => {
            const pct = Math.round((d.correct / d.total) * 100);
            return (
              <div key={d.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">{d.correct}/{d.total} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default Desempenho;