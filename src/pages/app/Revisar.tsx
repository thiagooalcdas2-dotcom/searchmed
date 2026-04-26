import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Check, X, Eye, Sparkles, Trash2, Calendar, Flame } from "lucide-react";
import { GRADE_LABELS, nextReview } from "@/lib/srs";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type CardRow = {
  id: string;
  question_id: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  last_grade: number | null;
  source: string;
  questions: any;
};

const Revisar = () => {
  const { user } = useAuth();
  const [due, setDue] = useState<CardRow[]>([]);
  const [allCards, setAllCards] = useState<CardRow[]>([]);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const nowIso = new Date().toISOString();
    const [{ data: dueData }, { data: allData }] = await Promise.all([
      supabase
        .from("review_cards")
        .select("*, questions(*)")
        .eq("user_id", user.id)
        .lte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(50),
      supabase
        .from("review_cards")
        .select("*, questions(*)")
        .eq("user_id", user.id)
        .order("due_at", { ascending: true }),
    ]);
    setDue((dueData as any) || []);
    setAllCards((allData as any) || []);
    setPos(0);
    setRevealed(false);
    setSelected(null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const current = due[pos];

  const grade = async (g: number) => {
    if (!current) return;
    const result = nextReview(
      { ease: current.ease, interval_days: current.interval_days, repetitions: current.repetitions },
      g,
    );
    const { error } = await supabase.from("review_cards").update({
      ease: result.ease,
      interval_days: result.interval_days,
      repetitions: result.repetitions,
      due_at: result.due_at,
      last_grade: g,
      last_reviewed_at: new Date().toISOString(),
    }).eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    setReviewedToday((n) => n + 1);
    if (pos + 1 >= due.length) {
      toast.success("Sessão concluída! 🎉");
      load();
    } else {
      setPos(pos + 1);
      setRevealed(false);
      setSelected(null);
    }
  };

  const removeCard = async (id: string) => {
    await supabase.from("review_cards").delete().eq("id", id);
    setAllCards((p) => p.filter((c) => c.id !== id));
    toast.success("Removida do caderno.");
  };

  const stats = useMemo(() => {
    const tomorrow = new Date(); tomorrow.setHours(23, 59, 59, 999);
    const week = new Date(); week.setDate(week.getDate() + 7);
    return {
      total: allCards.length,
      dueToday: due.length,
      dueTomorrow: allCards.filter((c) => new Date(c.due_at) <= tomorrow).length,
      thisWeek: allCards.filter((c) => new Date(c.due_at) <= week).length,
    };
  }, [allCards, due]);

  if (loading) return <div className="container py-12 text-muted-foreground">Carregando…</div>;

  return (
    <div className="container max-w-4xl py-10 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Caderno de erros</h1>
          <p className="text-sm text-muted-foreground">Revisão espaçada — repita no momento certo, esqueça menos.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} label="Para hoje" value={stats.dueToday} tone="destructive" />
        <Stat icon={Calendar} label="Até amanhã" value={stats.dueTomorrow} />
        <Stat icon={Calendar} label="Esta semana" value={stats.thisWeek} />
        <Stat icon={Brain} label="Total no caderno" value={stats.total} />
      </div>

      <Tabs defaultValue="study">
        <TabsList>
          <TabsTrigger value="study">Estudar agora ({stats.dueToday})</TabsTrigger>
          <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="study" className="mt-4">
          {due.length === 0 ? (
            <Card className="p-10 text-center bg-card-elegant border-border">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="font-display text-2xl mb-2">Nada pendente! 🎉</h2>
              <p className="text-muted-foreground mb-5">
                Volte mais tarde ou marque novas questões para o caderno respondendo o <Link to="/app/banco" className="text-primary underline">Banco</Link> ou um <Link to="/app/simulado" className="text-primary underline">Simulado</Link>.
              </p>
              {reviewedToday > 0 && <Badge variant="outline" className="border-success text-success">Hoje você revisou {reviewedToday}</Badge>}
            </Card>
          ) : current ? (
            <Card className="bg-card-elegant border-border p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                <Badge variant="outline">{pos + 1} / {due.length}</Badge>
                <Badge variant="outline" className="border-primary/40 text-primary">{current.questions.discipline}</Badge>
                <Badge variant="outline" className="capitalize">{current.questions.difficulty}</Badge>
                <span className="text-muted-foreground ml-auto">
                  Repetições: {current.repetitions} · facilidade {current.ease.toFixed(2)}
                </span>
              </div>

              <p className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-line">{current.questions.statement}</p>

              {current.questions.question_format !== "open_ended" && (
                <div className="space-y-2 mb-4">
                  {(current.questions.alternatives as any[]).map((a) => {
                    const isSel = selected === a.key;
                    const isRight = a.key === current.questions.correct_alternative;
                    let cls = "border-border hover:border-primary/50";
                    if (revealed) {
                      if (isRight) cls = "border-success bg-success/10";
                      else if (isSel) cls = "border-destructive bg-destructive/10";
                      else cls = "border-border opacity-60";
                    } else if (isSel) cls = "border-primary bg-primary/10";
                    return (
                      <button key={a.key} onClick={() => !revealed && setSelected(a.key)} disabled={revealed}
                        className={`w-full text-left p-3 rounded-lg border flex gap-3 transition ${cls}`}>
                        <span className="font-mono font-semibold text-primary">{a.key}</span>
                        <span className="flex-1 text-sm">{a.text}</span>
                        {revealed && isRight && <Check className="h-4 w-4 text-success" />}
                        {revealed && isSel && !isRight && <X className="h-4 w-4 text-destructive" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {!revealed ? (
                <Button onClick={() => setRevealed(true)} className="w-full bg-gradient-primary text-primary-foreground">
                  <Eye className="h-4 w-4 mr-2" /> Revelar gabarito
                </Button>
              ) : (
                <div className="space-y-4">
                  {current.questions.explanation && (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 text-sm leading-relaxed whitespace-pre-line">
                      <div className="text-xs uppercase tracking-wider text-primary mb-2">Comentário</div>
                      {current.questions.explanation}
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Como foi pra você?</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {GRADE_LABELS.map((g) => (
                        <button key={g.value} onClick={() => grade(g.value)}
                          className={`p-3 rounded-lg border text-left transition hover:scale-[1.02] ${
                            g.tone === "destructive" ? "border-destructive/40 hover:bg-destructive/10" :
                            g.tone === "gold" ? "border-gold/40 hover:bg-gold/10" :
                            g.tone === "success" ? "border-success/40 hover:bg-success/10" :
                            "border-primary/40 hover:bg-primary/10"
                          }`}>
                          <div className="font-display text-base">{g.label}</div>
                          <div className="text-xs text-muted-foreground">{g.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-2">
          {allCards.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground bg-card-elegant border-border">
              Seu caderno está vazio. Erre algumas questões — ou marque manualmente — e elas aparecerão aqui.
            </Card>
          )}
          {allCards.map((c) => {
            const dueDate = new Date(c.due_at);
            const isOverdue = dueDate <= new Date();
            return (
              <Card key={c.id} className="bg-card-elegant border-border p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <Badge variant="outline" className="border-primary/40 text-primary">{c.questions.discipline}</Badge>
                    <Badge variant="outline" className="capitalize">{c.questions.difficulty}</Badge>
                    {isOverdue && <Badge variant="destructive">Pendente</Badge>}
                    <span className="text-muted-foreground ml-auto">
                      {isOverdue ? "Devida " : "Próxima em "}
                      {dueDate.toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2 text-muted-foreground">{c.questions.statement}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeCard(c.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, tone }: any) => (
  <Card className="p-4 bg-card-elegant border-border">
    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
      <Icon className={`h-4 w-4 ${tone === "destructive" ? "text-destructive" : "text-primary"}`} />
      {label}
    </div>
    <div className={`font-display text-3xl mt-2 ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
  </Card>
);

export default Revisar;
