import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight, Sparkles, Library, BookOpen, TrendingUp, Repeat, Users, Flame,
  Target, Trophy, Bot, Zap, Clock, ChevronRight,
} from "lucide-react";

const modules = [
  { to: "/app/banco",     icon: Library,   title: "Banco de questões",   body: "Filtros em cascata por matéria, tópico e dificuldade." },
  { to: "/app/simulado",  icon: BookOpen,  title: "Simulados",           body: "Monte simulados sob medida em segundos." },
  { to: "/app/enamed",    icon: Sparkles,  title: "ENAMED & Residência", body: "Provas comentadas e questões inéditas com IA." },
  { to: "/app/revisar",   icon: Repeat,    title: "Caderno de erros",    body: "Revisão espaçada do que você mais errou." },
  { to: "/app/hub",       icon: Users,     title: "Hub",                 body: "Converse com outros estudantes do Brasil." },
  { to: "/app/desempenho",icon: TrendingUp,title: "Meu desempenho",      body: "Heatmap, ranking e evolução por matéria." },
];

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, correct: 0, today: 0, streak: 0 });
  const [weakest, setWeakest] = useState<{ name: string; pct: number; total: number } | null>(null);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const first = (prof?.full_name || user.email || "").split(/\s+/)[0]?.split("@")[0] || "";
      setName(first);

      const { data } = await supabase
        .from("question_attempts")
        .select("is_correct, created_at, questions(discipline)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const att = (data || []) as any[];

      const total = att.length;
      const correct = att.filter((a) => a.is_correct).length;

      const todayKey = new Date().toISOString().slice(0, 10);
      const today = att.filter((a) => new Date(a.created_at).toISOString().slice(0, 10) === todayKey).length;

      const days = new Set(att.map((a) => new Date(a.created_at).toISOString().slice(0, 10)));
      let streak = 0;
      const d = new Date();
      while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }

      const map = new Map<string, { c: number; t: number }>();
      att.forEach((a) => {
        const k = a.questions?.discipline || "Outros";
        const e = map.get(k) || { c: 0, t: 0 };
        e.t++; if (a.is_correct) e.c++;
        map.set(k, e);
      });
      let w: { name: string; pct: number; total: number } | null = null;
      map.forEach((v, k) => {
        if (v.t < 5) return;
        const pct = Math.round((v.c / v.t) * 100);
        if (!w || pct < w.pct) w = { name: k, pct, total: v.t };
      });
      setWeakest(w);
      setStats({ total, correct, today, streak });
    })();
  }, [user]);

  const acc = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  const hour = new Date().getHours();
  const greet = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const isNew = stats.total === 0;

  return (
    <div className="container max-w-6xl py-10 md:py-14">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">{greet}{name ? `, ${name}` : ""}</p>
        <h1 className="font-display text-3xl md:text-5xl mt-1">
          {isNew ? "Vamos começar sua jornada?" : "Pronto para mais uma dose de estudo?"}
        </h1>
      </div>

      {isNew && (
        <Card className="bg-card-elegant border-electric/30 p-6 md:p-8 mb-10 shadow-electric">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-electric/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6" style={{ color: "hsl(var(--electric))" }} />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl mb-2">Comece em 3 passos</h2>
              <ol className="space-y-2 text-sm text-muted-foreground mb-5">
                <li><span className="text-foreground font-medium">1.</span> Resolva 5 questões no Banco para calibrar seu nível.</li>
                <li><span className="text-foreground font-medium">2.</span> Monte um simulado curto (10 questões) sobre uma matéria.</li>
                <li><span className="text-foreground font-medium">3.</span> Revise os erros — eles entram automaticamente no caderno.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Link to="/app/banco"><Button size="sm" className="bg-electric text-electric-foreground hover:bg-electric-glow">Abrir banco <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
                <Link to="/app/simulado"><Button size="sm" variant="outline">Criar simulado</Button></Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!isNew && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Target} label="Acertos"   value={`${acc}%`}        sub={`${stats.correct} de ${stats.total}`} />
          <StatCard icon={Zap}    label="Hoje"      value={`${stats.today}`} sub="questões resolvidas" />
          <StatCard icon={Flame}  label="Sequência" value={`${stats.streak}`} sub={stats.streak === 1 ? "dia" : "dias"} accent />
          <StatCard icon={Trophy} label="Total"     value={`${stats.total}`} sub="no histórico" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {weakest ? (
          <Card className="bg-card-elegant border-border p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} />
              <Badge variant="outline" className="text-[10px]">Sugestão pra hoje</Badge>
            </div>
            <h3 className="font-display text-xl mb-1">Foco em {weakest.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">Sua taxa de acerto está em <span className="text-foreground font-semibold">{weakest.pct}%</span> ({weakest.total} questões). Uma rodada curta agora pode mover esse número.</p>
            <Progress value={weakest.pct} className="mb-4" />
            <Link to="/app/banco" className="mt-auto">
              <Button size="sm" className="bg-electric text-electric-foreground hover:bg-electric-glow">
                Treinar essa matéria <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </Card>
        ) : (
          <Card className="bg-card-elegant border-border p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} />
              <Badge variant="outline" className="text-[10px]">Mini-treino</Badge>
            </div>
            <h3 className="font-display text-xl mb-1">15 minutos, 10 questões</h3>
            <p className="text-sm text-muted-foreground mb-4">Quando você não sabe por onde começar, comece pelo simulado rápido. A plataforma escolhe um mix equilibrado pra você.</p>
            <Link to="/app/simulado" className="mt-auto">
              <Button size="sm" className="bg-electric text-electric-foreground hover:bg-electric-glow">
                Criar agora <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </Card>
        )}

        <Card className="bg-card-elegant border-border p-6 flex flex-col relative overflow-hidden">
          <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30" style={{ background: "radial-gradient(closest-side, hsl(var(--electric)/0.4), transparent)" }} />
          <div className="relative flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} />
            <Badge variant="outline" className="text-[10px]">MedQuest AI</Badge>
          </div>
          <h3 className="relative font-display text-xl mb-1">Tire qualquer dúvida</h3>
          <p className="relative text-sm text-muted-foreground mb-4">Bateu uma dúvida no meio da questão? Clique no botão flutuante no canto inferior direito e pergunte direto à IA — sobre o conteúdo ou qualquer outra coisa.</p>
          <div className="relative mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-electric animate-pulse" /> Sempre online
          </div>
        </Card>
      </div>

      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl">Seus módulos</h2>
        <Link to="/app/desempenho" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Ver desempenho <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="bg-card-elegant border-border p-6 h-full hover:border-electric/40 hover:shadow-electric transition-all group">
              <div className="h-10 w-10 rounded-xl bg-electric/10 flex items-center justify-center mb-3 group-hover:bg-electric/20 transition-colors">
                <c.icon className="h-5 w-5" style={{ color: "hsl(var(--electric))" }} />
              </div>
              <h3 className="font-display text-xl mb-1">{c.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{c.body}</p>
              <div className="text-sm flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "hsl(var(--electric))" }}>
                Abrir <ArrowRight className="h-4 w-4" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub: string; accent?: boolean }) => (
  <Card className={`bg-card-elegant ${accent ? "border-electric/40" : "border-border"} p-4`}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" style={{ color: accent ? "hsl(var(--electric))" : undefined }} />
      {label}
    </div>
    <div className="font-display text-3xl mt-1.5 leading-none">{value}</div>
    <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
  </Card>
);

export default Home;