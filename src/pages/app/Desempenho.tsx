import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, TrendingUp, Flame, Calendar, ChevronRight, Crown, Award, Zap, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from "recharts";

type DiscStat = { name: string; correct: number; total: number };
type RankRow = { user_id: string; name: string; total: number; correct: number; pct: number; points: number; tier: string };
type DailyPoint = { date: string; label: string; total: number; correct: number; pct: number };
type HeatCell = { discipline: string; easy: { c: number; t: number }; medium: { c: number; t: number }; hard: { c: number; t: number } };
type SimRow = { id: string; title: string; total_questions: number; correct_count: number | null; score: number | null; finished_at: string | null; started_at: string };

const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };

// Pontuação: cada acerto vale por dificuldade. Erro vale 0. Volume importa, mas % também.
// pontos = easy*1 + medium*2 + hard*3 (apenas em acertos), com bônus de consistência.
function tierFor(rank: number): { label: string; tone: string } {
  if (rank === 1) return { label: "Diamante", tone: "diamond" };
  if (rank <= 3) return { label: "Pódio", tone: "gold" };
  if (rank <= 10) return { label: "Top 10", tone: "primary" };
  if (rank <= 25) return { label: "Top 25", tone: "silver" };
  if (rank <= 50) return { label: "Top 50", tone: "bronze" };
  return { label: "Competidor", tone: "muted" };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?";
}

function pctColor(pct: number) {
  if (pct >= 80) return "bg-success/80";
  if (pct >= 60) return "bg-primary/80";
  if (pct >= 40) return "bg-gold/80";
  if (pct > 0) return "bg-destructive/70";
  return "bg-secondary";
}

const Desempenho = () => {
  const { user } = useAuth();
  const [byDiscipline, setByDiscipline] = useState<DiscStat[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0 });
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [streak, setStreak] = useState(0);
  const [sims, setSims] = useState<SimRow[]>([]);
  const [discDetail, setDiscDetail] = useState<{ name: string; cells: HeatCell } | null>(null);
  const [discAttempts, setDiscAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("question_attempts")
        .select("is_correct, created_at, question_id, questions(discipline, difficulty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const att = (data || []) as any[];

      // Por disciplina
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

      // Evolução diária (últimos 30 dias)
      const days = 30;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const buckets = new Map<string, { t: number; c: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        buckets.set(d.toISOString().slice(0, 10), { t: 0, c: 0 });
      }
      att.forEach(a => {
        const k = new Date(a.created_at).toISOString().slice(0, 10);
        if (buckets.has(k)) {
          const e = buckets.get(k)!;
          e.t += 1; if (a.is_correct) e.c += 1;
        }
      });
      const dailyArr: DailyPoint[] = [...buckets.entries()].map(([date, v]) => {
        const d = new Date(date);
        return {
          date,
          label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          total: v.t,
          correct: v.c,
          pct: v.t ? Math.round((v.c / v.t) * 100) : 0,
        };
      });
      setDaily(dailyArr);

      // Streak (dias consecutivos com >=1 atividade até hoje)
      let s = 0;
      for (let i = dailyArr.length - 1; i >= 0; i--) {
        if (dailyArr[i].total > 0) s++; else break;
      }
      setStreak(s);

      // Heatmap matéria × dificuldade
      const heatMap = new Map<string, HeatCell>();
      att.forEach(a => {
        const disc = a.questions?.discipline || "Outros";
        const diff = (a.questions?.difficulty || "medium") as "easy" | "medium" | "hard";
        if (!heatMap.has(disc)) heatMap.set(disc, { discipline: disc, easy: { c: 0, t: 0 }, medium: { c: 0, t: 0 }, hard: { c: 0, t: 0 } });
        const cell = heatMap.get(disc)!;
        cell[diff].t += 1; if (a.is_correct) cell[diff].c += 1;
      });
      setHeat([...heatMap.values()].sort((a, b) =>
        (b.easy.t + b.medium.t + b.hard.t) - (a.easy.t + a.medium.t + a.hard.t)
      ));

      // Simulados
      const { data: simData } = await supabase
        .from("simulados")
        .select("id, title, total_questions, correct_count, score, finished_at, started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);
      setSims((simData || []) as SimRow[]);

      // Ranking
      const { data: allAtt } = await supabase
        .from("question_attempts")
        .select("user_id, is_correct, questions(difficulty)");
      const { data: profs } = await supabase.from("profiles").select("id, full_name");
      const nameOf = new Map<string, string>((profs || []).map((p: any) => [p.id, p.full_name || "Usuário"]));
      const agg = new Map<string, { t: number; c: number; points: number }>();
      (allAtt || []).forEach((a: any) => {
        const e = agg.get(a.user_id) || { t: 0, c: 0, points: 0 };
        e.t += 1;
        if (a.is_correct) {
          e.c += 1;
          const diff = a.questions?.difficulty || "medium";
          e.points += diff === "hard" ? 3 : diff === "easy" ? 1 : 2;
        }
        agg.set(a.user_id, e);
      });
      const ranked = [...agg.entries()]
        .filter(([, v]) => v.t >= 1)
        .map(([uid, v]) => ({
          user_id: uid,
          name: nameOf.get(uid) || (uid === user.id ? "Você" : "Usuário"),
          total: v.t,
          correct: v.c,
          pct: Math.round((v.c / v.t) * 100),
          points: v.points,
        }))
        // Ordena por pontos (volume × dificuldade × acerto) — combate a "100% com 1 questão"
        .sort((a, b) => b.points - a.points || b.pct - a.pct || b.total - a.total)
        .slice(0, 100);
      const rows: RankRow[] = ranked.map((r, i) => ({ ...r, tier: tierFor(i + 1).label }));
      setRanking(rows);
    })();
  }, [user]);

  const last7 = useMemo(() => daily.slice(-7), [daily]);
  const last7Total = last7.reduce((s, d) => s + d.total, 0);
  const myRank = useMemo(() => ranking.findIndex(r => r.user_id === user?.id) + 1, [ranking, user]);
  const myRow = ranking.find(r => r.user_id === user?.id);

  const openDiscipline = async (name: string) => {
    if (!user) return;
    const cell = heat.find(h => h.discipline === name);
    if (cell) setDiscDetail({ name, cells: cell });
    const { data } = await supabase
      .from("question_attempts")
      .select("is_correct, created_at, selected_alternative, questions(statement, discipline, difficulty, correct_alternative, subtopic)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setDiscAttempts((data || []).filter((a: any) => a.questions?.discipline === name));
  };

  return (
    <div className="container max-w-5xl py-12">
      <h1 className="font-display text-4xl mb-2">Meu Desempenho</h1>
      <p className="text-muted-foreground mb-8">Onde você acerta, onde precisa estudar — e como está no ranking.</p>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card-elegant border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total respondido</div>
          <div className="font-display text-3xl mt-2">{overall.total}</div>
        </Card>
        <Card className="bg-card-elegant border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Aproveitamento</div>
          <div className="font-display text-3xl mt-2 text-gradient">
            {overall.total ? Math.round((overall.correct / overall.total) * 100) : 0}%
          </div>
        </Card>
        <Card className="bg-card-elegant border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3" /> Streak</div>
          <div className="font-display text-3xl mt-2">{streak}<span className="text-base text-muted-foreground ml-1">dias</span></div>
        </Card>
        <Card className="bg-card-elegant border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Últimos 7 dias</div>
          <div className="font-display text-3xl mt-2">{last7Total}<span className="text-base text-muted-foreground ml-1">questões</span></div>
        </Card>
      </div>

      <Tabs defaultValue="evolucao">
        <TabsList className="bg-secondary">
          <TabsTrigger value="evolucao"><TrendingUp className="h-4 w-4 mr-2" />Evolução</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="materias">Por matéria</TabsTrigger>
          <TabsTrigger value="simulados"><Calendar className="h-4 w-4 mr-2" />Simulados</TabsTrigger>
          <TabsTrigger value="ranking"><Trophy className="h-4 w-4 mr-2" />Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="mt-4 space-y-4">
          <Card className="bg-card-elegant border-border p-6">
            <div className="font-display text-lg mb-4">Aproveitamento diário (30 dias)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="pctG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, n: string) => n === "pct" ? [`${v}%`, "Acerto"] : [v, n]}
                  />
                  <Area type="monotone" dataKey="pct" stroke="hsl(var(--primary))" fill="url(#pctG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="bg-card-elegant border-border p-6">
            <div className="font-display text-lg mb-4">Volume diário</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--gold))" strokeWidth={2} dot={false} name="Respondidas" />
                  <Line type="monotone" dataKey="correct" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Acertos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Card className="bg-card-elegant border-border p-6 overflow-x-auto">
            <div className="font-display text-lg mb-4">Matéria × Dificuldade</div>
            {heat.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-2 pr-4">Matéria</th>
                    {(["easy", "medium", "hard"] as const).map(d => (
                      <th key={d} className="text-center px-2">{DIFF_LABEL[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heat.map(row => (
                    <tr key={row.discipline} className="border-t border-border">
                      <td className="py-2 pr-4 font-medium">{row.discipline}</td>
                      {(["easy", "medium", "hard"] as const).map(d => {
                        const cell = row[d];
                        const pct = cell.t ? Math.round((cell.c / cell.t) * 100) : 0;
                        return (
                          <td key={d} className="px-2 py-1.5">
                            <div className={`rounded-md px-3 py-2 text-center ${pctColor(cell.t ? pct : -1)} ${cell.t === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                              {cell.t === 0 ? "—" : (
                                <>
                                  <div className="font-display text-base">{pct}%</div>
                                  <div className="text-[10px] opacity-80">{cell.c}/{cell.t}</div>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex gap-3 mt-4 text-xs text-muted-foreground items-center">
              <span>Legenda:</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/70" /> &lt;40%</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gold/80" /> 40-59%</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary/80" /> 60-79%</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/80" /> ≥80%</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="materias" className="mt-4">
          <Card className="bg-card-elegant border-border p-6">
            {byDiscipline.length === 0 && <p className="text-sm text-muted-foreground">Responda algumas questões para ver suas estatísticas.</p>}
            <div className="space-y-3">
              {byDiscipline.map(d => {
                const pct = Math.round((d.correct / d.total) * 100);
                return (
                  <button
                    key={d.name}
                    onClick={() => openDiscipline(d.name)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/40 transition-all group"
                  >
                    <div className="flex justify-between text-sm mb-1.5 items-center">
                      <span className="font-medium flex items-center gap-2">
                        {d.name}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="text-muted-foreground text-xs">{d.correct}/{d.total} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Clique em uma matéria para ver detalhes por dificuldade e tentativas recentes.</p>
          </Card>
        </TabsContent>

        <TabsContent value="simulados" className="mt-4">
          <Card className="bg-card-elegant border-border p-6">
            {sims.length === 0 ? (
              <p className="text-sm text-muted-foreground">Você ainda não fez nenhum simulado. <Link to="/app/simulado" className="text-primary underline">Começar agora</Link>.</p>
            ) : (
              <ul className="space-y-2">
                {sims.map(s => {
                  const done = !!s.finished_at;
                  const pct = s.score != null ? Math.round(Number(s.score)) : (s.correct_count != null ? Math.round((s.correct_count / s.total_questions) * 100) : null);
                  const date = new Date(s.finished_at || s.started_at);
                  return (
                    <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {date.toLocaleDateString("pt-BR")} · {s.total_questions} questões {done ? "" : "· em andamento"}
                        </div>
                      </div>
                      {pct != null ? (
                        <span className="font-display text-xl text-gradient w-16 text-right">{pct}%</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          {ranking.length === 0 ? (
            <Card className="bg-card-elegant border-border p-10 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">A arena está vazia. Responda questões para entrar na disputa.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Card "minha posição" */}
              {myRow && (
                <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5">
                  <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />
                  <div className="relative flex items-center gap-4 flex-wrap">
                    <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-display text-xl shadow-glow">
                      {initials(myRow.name)}
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Sua posição</div>
                      <div className="font-display text-2xl flex items-baseline gap-2">
                        #{myRank}
                        <Badge variant="outline" className="border-primary/50 text-primary">{tierFor(myRank).label}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontos</div>
                        <div className="font-display text-xl text-gradient">{myRow.points}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Acerto</div>
                        <div className="font-display text-xl">{myRow.pct}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume</div>
                        <div className="font-display text-xl">{myRow.total}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Pódio */}
              {ranking.length >= 3 && (
                <div className="grid grid-cols-3 gap-3 items-end">
                  {[1, 0, 2].map((idx) => {
                    const r = ranking[idx];
                    if (!r) return <div key={idx} />;
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const heightClass = isFirst ? "pt-8 pb-6" : isSecond ? "pt-6 pb-5" : "pt-5 pb-4";
                    const ringClass = isFirst
                      ? "ring-2 ring-gold shadow-[0_0_40px_-10px_hsl(var(--gold)/0.6)]"
                      : isSecond
                      ? "ring-2 ring-muted-foreground/40"
                      : "ring-2 ring-amber-700/50";
                    const medalColor = isFirst ? "text-gold" : isSecond ? "text-muted-foreground" : "text-amber-600";
                    const Icon = isFirst ? Crown : Medal;
                    return (
                      <Card
                        key={r.user_id}
                        className={`bg-card-elegant border-border ${heightClass} px-4 text-center ${ringClass} ${r.user_id === user?.id ? "border-primary" : ""}`}
                      >
                        <Icon className={`h-7 w-7 mx-auto mb-2 ${medalColor}`} />
                        <div className={`mx-auto rounded-full bg-secondary flex items-center justify-center font-display ${isFirst ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"}`}>
                          {initials(r.name)}
                        </div>
                        <div className="text-xs mt-2 truncate font-medium">{r.user_id === user?.id ? "Você" : r.name}</div>
                        <div className="font-display text-lg text-gradient mt-1">{r.points} pts</div>
                        <div className="text-[10px] text-muted-foreground">{r.pct}% · {r.total} q.</div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Lista geral */}
              <Card className="bg-card-elegant border-border p-3">
                <div className="flex items-center justify-between px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>Posição</span>
                  <div className="flex gap-6">
                    <span className="w-14 text-right">Pontos</span>
                    <span className="w-12 text-right">Acerto</span>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {ranking.map((r, i) => {
                    const rank = i + 1;
                    const isMe = r.user_id === user?.id;
                    const t = tierFor(rank);
                    return (
                      <li key={r.user_id}
                        className={`flex items-center gap-3 px-2 py-2.5 ${isMe ? "bg-primary/10 rounded-md -mx-1 px-3 border-l-2 border-primary" : ""}`}>
                        <span className="w-10 flex justify-center">
                          {rank === 1 && <Crown className="h-5 w-5 text-gold" />}
                          {rank === 2 && <Medal className="h-5 w-5 text-muted-foreground" />}
                          {rank === 3 && <Medal className="h-5 w-5 text-amber-600" />}
                          {rank > 3 && (
                            <span className={`font-mono text-sm ${rank <= 10 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              #{rank}
                            </span>
                          )}
                        </span>
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-display shrink-0">
                          {initials(r.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{isMe ? "Você" : r.name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span>{r.total} questões</span>
                            {rank <= 50 && (
                              <Badge variant="outline" className={`text-[9px] py-0 px-1.5 h-3.5 ${
                                t.tone === "diamond" ? "border-primary/60 text-primary" :
                                t.tone === "gold" ? "border-gold/60 text-gold" :
                                t.tone === "primary" ? "border-primary/40 text-primary" :
                                t.tone === "silver" ? "border-muted-foreground/40 text-muted-foreground" :
                                "border-amber-700/50 text-amber-600"
                              }`}>
                                {t.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-6 items-center">
                          <span className="font-display text-sm text-gradient w-14 text-right">{r.points}</span>
                          <span className="text-xs text-muted-foreground w-12 text-right">{r.pct}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <div className="text-xs text-muted-foreground text-center px-4">
                <Zap className="h-3 w-3 inline mr-1 text-gold" />
                Pontos = acertos ponderados pela dificuldade (Fácil 1 · Médio 2 · Difícil 3). Resolver mais e mais difícil sobe mais rápido.
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Drilldown por matéria */}
      <Dialog open={!!discDetail} onOpenChange={(o) => !o && setDiscDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {discDetail?.name}
            </DialogTitle>
          </DialogHeader>
          {discDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map(d => {
                  const cell = discDetail.cells[d];
                  const pct = cell.t ? Math.round((cell.c / cell.t) * 100) : 0;
                  return (
                    <div key={d} className="rounded-lg border border-border p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{DIFF_LABEL[d]}</div>
                      <div className="font-display text-2xl mt-1">{cell.t ? `${pct}%` : "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{cell.c}/{cell.t}</div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tentativas recentes</div>
                {discAttempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem tentativas registradas.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {discAttempts.slice(0, 30).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 p-2 rounded border border-border text-xs">
                        {a.is_correct ? (
                          <span className="h-5 w-5 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">✓</span>
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0">✗</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="line-clamp-2">{a.questions?.statement}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {a.questions?.subtopic && <span className="mr-2">{a.questions.subtopic}</span>}
                            <span className="capitalize">{a.questions?.difficulty}</span>
                            <span className="mx-1">·</span>
                            {new Date(a.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Desempenho;
