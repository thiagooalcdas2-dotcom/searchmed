import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useRole";
import { Shield, Users, FileQuestion, ListChecks, BookOpen, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Admin = () => {
  const { isAdmin, loading } = useIsAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [simulados, setSimulados] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [target, setTarget] = useState(3000);
  const [batch, setBatch] = useState(15);
  const [running, setRunning] = useState(false);
  const [insertedRun, setInsertedRun] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [p, a, s, q] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("question_attempts").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("simulados").select("*").order("started_at", { ascending: false }).limit(100),
        supabase.from("questions").select("id, discipline, origin, review_status, ai_generated, created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      setProfiles(p.data || []);
      setAttempts(a.data || []);
      setSimulados(s.data || []);
      setQuestions(q.data || []);
      const { count } = await supabase.from("questions").select("*", { count: "exact", head: true });
      setTotalQuestions(count || 0);
    })();
  }, [isAdmin]);

  const refreshTotal = async () => {
    const { count } = await supabase.from("questions").select("*", { count: "exact", head: true });
    setTotalQuestions(count || 0);
  };

  const startBulk = async () => {
    setRunning(true);
    setInsertedRun(0);
    try {
      while (true) {
        const { count } = await supabase.from("questions").select("*", { count: "exact", head: true });
        const current = count || 0;
        setTotalQuestions(current);
        if (current >= target) { toast.success(`Meta atingida: ${current} questões.`); break; }
        const { data, error } = await supabase.functions.invoke("ai-bulk-generate", { body: { batch } });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        const ins = (data as any).inserted || 0;
        setInsertedRun((p) => p + ins);
        if (ins === 0) { toast.error("Lote sem inserções, parando."); break; }
        // pequena pausa para não bater rate limit
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e: any) {
      toast.error(e.message || "Falha na geração em lote");
    } finally {
      setRunning(false);
      refreshTotal();
    }
  };

  const stopBulk = () => setRunning(false); // a próxima checagem encerra

  if (loading) return <div className="container py-12 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/app" replace />;

  const totalAcc = attempts.length ? Math.round((attempts.filter(a => a.is_correct).length / attempts.length) * 100) : 0;

  return (
    <div className="container max-w-7xl py-12 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Acesso restrito</p>
          <h1 className="font-display text-4xl">Painel Administrativo</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Usuários" value={profiles.length} />
        <StatCard icon={ListChecks} label="Tentativas" value={attempts.length} hint={`${totalAcc}% acerto`} />
        <StatCard icon={BookOpen} label="Simulados" value={simulados.length} />
        <StatCard icon={FileQuestion} label="Questões totais" value={totalQuestions} />
      </div>

      <Section title="Geração em massa de questões (IA — não oficial)">
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Meta total no banco</Label>
              <Input type="number" min={100} max={10000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
            <div>
              <Label>Tamanho do lote</Label>
              <Input type="number" min={1} max={25} value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={startBulk} disabled={running} className="flex-1 bg-gradient-primary text-primary-foreground">
                {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</> : <><Sparkles className="h-4 w-4 mr-2" />Iniciar</>}
              </Button>
              {running && <Button variant="outline" onClick={stopBulk}>Parar</Button>}
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso até a meta</span>
              <span>{totalQuestions} / {target} {running && `(+${insertedRun} nesta sessão)`}</span>
            </div>
            <Progress value={Math.min(100, (totalQuestions / target) * 100)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Distribui ano × matéria × dificuldade aleatoriamente; ~20% das questões são dissertativas. Todas são salvas com o rótulo <strong>IA — não oficial</strong>.
          </p>
        </div>
      </Section>

      <Section title="Usuários cadastrados">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Tentativas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map(p => {
              const userAttempts = attempts.filter(a => a.user_id === p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell>{p.crm || "—"}</TableCell>
                  <TableCell>{p.course_period || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{userAttempts.length}</TableCell>
                </TableRow>
              );
            })}
            {profiles.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário ainda</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Section>

      <Section title="Simulados realizados">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Questões</TableHead>
              <TableHead>Acertos</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {simulados.map(s => {
              const u = profiles.find(p => p.id === s.user_id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell>{u?.full_name || s.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{s.total_questions}</TableCell>
                  <TableCell>{s.correct_count ?? "—"}</TableCell>
                  <TableCell>{s.score != null ? `${s.score}%` : <Badge variant="secondary">em curso</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              );
            })}
            {simulados.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum simulado ainda</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Section>

      <Section title="Tentativas recentes (últimas 200)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Alternativa</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.slice(0, 50).map(a => {
              const u = profiles.find(p => p.id === a.user_id);
              return (
                <TableRow key={a.id}>
                  <TableCell>{u?.full_name || a.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono">{a.selected_alternative}</TableCell>
                  <TableCell>{a.is_correct ? <Badge>Correta</Badge> : <Badge variant="destructive">Incorreta</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              );
            })}
            {attempts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem tentativas</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, hint }: any) => (
  <Card className="p-5">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div className="mt-3 font-display text-3xl">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </Card>
);

const Section = ({ title, children }: any) => (
  <Card className="p-6">
    <h2 className="font-display text-2xl mb-4">{title}</h2>
    <div className="overflow-x-auto">{children}</div>
  </Card>
);

export default Admin;
