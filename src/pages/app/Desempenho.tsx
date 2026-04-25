import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal } from "lucide-react";

type DiscStat = { name: string; correct: number; total: number };
type RankRow = { user_id: string; name: string; total: number; correct: number; pct: number };

const Desempenho = () => {
  const { user } = useAuth();
  const [byDiscipline, setByDiscipline] = useState<DiscStat[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0 });
  const [ranking, setRanking] = useState<RankRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pessoal: por disciplina
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
      setByDiscipline([...map.entries()].map(([name, v]) => ({ name, correct: v.c, total: v.t })).sort((a, b) => b.total - a.total));

      // Ranking global (todos podem ler suas próprias tentativas, então cada cliente só verá si mesmo + admins veem todos).
      // Para um ranking real, idealmente uma view pública ou edge function. Por ora: agrega o que dá pra ler.
      const { data: allAtt } = await supabase
        .from("question_attempts")
        .select("user_id, is_correct");
      const { data: profs } = await supabase.from("profiles").select("id, full_name");
      const nameOf = new Map<string, string>((profs || []).map((p: any) => [p.id, p.full_name || "Usuário"]));
      const agg = new Map<string, { t: number; c: number }>();
      (allAtt || []).forEach((a: any) => {
        const e = agg.get(a.user_id) || { t: 0, c: 0 };
        e.t += 1; if (a.is_correct) e.c += 1;
        agg.set(a.user_id, e);
      });
      const rows: RankRow[] = [...agg.entries()]
        .filter(([, v]) => v.t >= 1)
        .map(([uid, v]) => ({
          user_id: uid,
          name: nameOf.get(uid) || (uid === user.id ? "Você" : "Usuário"),
          total: v.t,
          correct: v.c,
          pct: Math.round((v.c / v.t) * 100),
        }))
        .sort((a, b) => b.pct - a.pct || b.total - a.total)
        .slice(0, 50);
      setRanking(rows);
    })();
  }, [user]);

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="font-display text-4xl mb-2">Meu Desempenho</h1>
      <p className="text-muted-foreground mb-8">Onde você acerta, onde precisa estudar — e como está no ranking.</p>

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

      <Tabs defaultValue="materias">
        <TabsList className="bg-secondary">
          <TabsTrigger value="materias">Por matéria</TabsTrigger>
          <TabsTrigger value="ranking"><Trophy className="h-4 w-4 mr-2" />Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="materias" className="mt-4">
          <Card className="bg-card-elegant border-border p-6">
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
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <Card className="bg-card-elegant border-border p-6">
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de ranking ainda.</p>
            ) : (
              <ul className="space-y-2">
                {ranking.map((r, i) => {
                  const isMe = r.user_id === user?.id;
                  return (
                    <li key={r.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${isMe ? "border-primary bg-primary/10" : "border-border"}`}>
                      <span className="font-mono w-8 text-center">
                        {i < 3 ? <Medal className={`h-5 w-5 mx-auto ${i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : "text-primary"}`} /> : i + 1}
                      </span>
                      <span className="flex-1 truncate">{isMe ? "Você" : r.name}</span>
                      <span className="text-sm text-muted-foreground">{r.correct}/{r.total}</span>
                      <span className="font-display text-lg text-gradient w-14 text-right">{r.pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              O ranking exibe quem você consegue ver com base nas permissões. Para o ranking global completo, peça ao administrador para liberar a visualização agregada.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Desempenho;