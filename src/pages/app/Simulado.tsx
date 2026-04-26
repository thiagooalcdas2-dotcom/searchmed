import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { enqueueManyWrong } from "@/lib/reviewQueue";
import { Clock, ChevronLeft, ChevronRight, Flag, Check, X, AlertTriangle, RotateCcw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Q = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  correct_alternative: string;
  explanation: string;
  discipline: string;
  difficulty: string;
  origin: string;
  course_year?: string;
  question_format?: "multiple_choice" | "open_ended";
  expected_answer?: string | null;
  is_ai_unofficial?: boolean;
  media_url?: string | null;
  media_caption?: string | null;
};

type Stage = "setup" | "running" | "finished";

const Simulado = () => {
  const { user } = useAuth();

  // Setup
  const [count, setCount] = useState(20);
  const [filter, setFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });
  const [withTimer, setWithTimer] = useState(true);
  const [secondsPerQ, setSecondsPerQ] = useState(120);
  const [excludeOpen, setExcludeOpen] = useState(false);

  // Run state
  const [stage, setStage] = useState<Stage>("setup");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // qid -> alt key (or open text)
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [simuladoId, setSimuladoId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const total = questions.length;
  const current = questions[index];

  // Timer
  useEffect(() => {
    if (stage !== "running" || !withTimer) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(intervalRef.current!);
          finish(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, withTimer]);

  const start = async () => {
    let q = supabase.from("questions").select("*").eq("review_status", "approved");
    if (filter.year !== "geral") q = q.eq("course_year", filter.year as any);
    if (filter.discipline !== "all") q = q.eq("discipline", filter.discipline);
    if (filter.difficulty !== "all") q = q.eq("difficulty", filter.difficulty as any);
    if (excludeOpen) q = q.eq("question_format", "multiple_choice");
    const { data, error } = await q.limit(500);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Sem questões para esse filtro."); return; }
    const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, count) as any[];
    setQuestions(shuffled);
    setAnswers({});
    setFlagged(new Set());
    setIndex(0);
    setTimeLeft(secondsPerQ * shuffled.length);

    // Cria registro do simulado já no início
    if (user) {
      const { data: sim } = await supabase.from("simulados").insert({
        user_id: user.id,
        title: `Simulado · ${new Date().toLocaleDateString("pt-BR")}`,
        question_ids: shuffled.map((q) => q.id),
        total_questions: shuffled.length,
        config: { filter, withTimer, secondsPerQ, excludeOpen },
      }).select().single();
      setSimuladoId(sim?.id || null);
    }
    setStage("running");
  };

  const setAnswer = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const toggleFlag = (qid: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(qid) ? next.delete(qid) : next.add(qid);
      return next;
    });
  };

  const finish = async (auto = false) => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    // Calcula resultado
    let correct = 0;
    const inserts = questions.map((q) => {
      const sel = answers[q.id] || "";
      const isCorrect = q.question_format === "open_ended"
        ? false // dissertativas não entram no score automático aqui
        : sel === q.correct_alternative;
      if (isCorrect) correct++;
      return {
        user_id: user?.id,
        question_id: q.id,
        selected_alternative: sel || "—",
        is_correct: isCorrect,
        simulado_id: simuladoId,
      };
    }).filter((r) => r.user_id);

    if (inserts.length > 0) {
      await supabase.from("question_attempts").insert(inserts as any);
    }
    if (simuladoId) {
      await supabase.from("simulados").update({
        correct_count: correct,
        score: total ? Math.round((correct / total) * 100) : 0,
        finished_at: new Date().toISOString(),
      }).eq("id", simuladoId);
    }
    // Enfileira erradas no caderno de revisão
    if (user) {
      const wrongIds = questions
        .filter((q) => q.question_format !== "open_ended" && answers[q.id] && answers[q.id] !== q.correct_alternative)
        .map((q) => q.id);
      const blankIds = questions
        .filter((q) => q.question_format !== "open_ended" && !answers[q.id])
        .map((q) => q.id);
      await enqueueManyWrong(user.id, [...wrongIds, ...blankIds], "simulado_wrong");
    }
    setStage("finished");
    if (auto) toast.warning("Tempo esgotado — simulado encerrado.");
  };

  const restartSameWrong = async () => {
    const wrong = questions.filter((q) =>
      q.question_format !== "open_ended" && answers[q.id] !== q.correct_alternative
    );
    if (wrong.length === 0) { toast.success("Você acertou tudo! 🎉"); return; }
    setQuestions(wrong);
    setAnswers({});
    setFlagged(new Set());
    setIndex(0);
    setTimeLeft(secondsPerQ * wrong.length);
    setSimuladoId(null);
    if (user) {
      const { data: sim } = await supabase.from("simulados").insert({
        user_id: user.id,
        title: `Refazer erradas · ${new Date().toLocaleDateString("pt-BR")}`,
        question_ids: wrong.map((q) => q.id),
        total_questions: wrong.length,
        config: { filter, withTimer, secondsPerQ, excludeOpen, mode: "redo_wrong" },
      }).select().single();
      setSimuladoId(sim?.id || null);
    }
    setStage("running");
  };

  const reset = () => {
    setStage("setup");
    setQuestions([]);
    setAnswers({});
    setFlagged(new Set());
    setSimuladoId(null);
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const answered = useMemo(() => Object.keys(answers).filter((k) => answers[k]).length, [answers]);

  // ============ SETUP ============
  if (stage === "setup") {
    return (
      <div className="container max-w-2xl py-12">
        <h1 className="font-display text-4xl mb-2">Montar simulado</h1>
        <p className="text-muted-foreground mb-8">Modo prova: sem feedback durante a execução.</p>
        <Card className="bg-card-elegant border-border p-6 space-y-5">
          <CascadeFilter value={filter} onChange={setFilter} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número de questões</Label>
              <Input type="number" min={1} max={120} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Segundos por questão</Label>
              <Input type="number" min={30} max={600} value={secondsPerQ} disabled={!withTimer}
                onChange={(e) => setSecondsPerQ(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="cursor-pointer">Cronômetro</Label>
              <p className="text-xs text-muted-foreground">Encerra automaticamente ao zerar.</p>
            </div>
            <Switch checked={withTimer} onCheckedChange={setWithTimer} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="cursor-pointer">Apenas múltipla escolha</Label>
              <p className="text-xs text-muted-foreground">Exclui questões dissertativas.</p>
            </div>
            <Switch checked={excludeOpen} onCheckedChange={setExcludeOpen} />
          </div>
          <Button onClick={start} className="w-full bg-gradient-primary text-primary-foreground shadow-glow" size="lg">
            Iniciar simulado
          </Button>
        </Card>
      </div>
    );
  }

  // ============ RUNNING ============
  if (stage === "running" && current) {
    const progress = ((index + 1) / total) * 100;
    const isOpen = current.question_format === "open_ended";
    const sel = answers[current.id];

    return (
      <div className="container max-w-5xl py-6 md:py-10">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline">Questão {index + 1} de {total}</Badge>
            <span className="text-sm text-muted-foreground">{answered} respondidas · {flagged.size} marcadas</span>
          </div>
          {withTimer && (
            <div className={`flex items-center gap-2 font-mono text-lg ${timeLeft < 60 ? "text-destructive" : ""}`}>
              <Clock className="h-4 w-4" /> {fmtTime(timeLeft)}
            </div>
          )}
        </div>
        <Progress value={progress} className="mb-6" />

        <div className="grid lg:grid-cols-[1fr_240px] gap-6">
          {/* Card da questão */}
          <Card className="bg-card-elegant border-border p-6 md:p-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="border-primary/40 text-primary">{current.discipline}</Badge>
              <Badge variant="outline" className="capitalize">{current.difficulty}</Badge>
              {isOpen && <Badge variant="outline" className="border-primary/40">Dissertativa</Badge>}
              {current.is_ai_unofficial && <Badge variant="outline" className="border-destructive/50 text-destructive">IA — não oficial</Badge>}
              <button
                onClick={() => toggleFlag(current.id)}
                className={`ml-auto text-xs flex items-center gap-1 px-2 py-1 rounded border transition ${
                  flagged.has(current.id) ? "border-gold text-gold bg-gold/10" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flag className="h-3.5 w-3.5" /> {flagged.has(current.id) ? "Marcada" : "Marcar para revisão"}
              </button>
            </div>
            <p className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-line">{current.statement}</p>
            {current.media_url && (
              <figure className="mb-6">
                <img src={current.media_url} alt={current.media_caption || ""} className="rounded-lg border border-border w-full" />
                {current.media_caption && <figcaption className="text-xs text-muted-foreground mt-2">{current.media_caption}</figcaption>}
              </figure>
            )}

            {isOpen ? (
              <Textarea
                value={sel || ""}
                onChange={(e) => setAnswer(current.id, e.target.value)}
                rows={6}
                placeholder="Escreva sua resposta dissertativa…"
              />
            ) : (
              <div className="space-y-2">
                {current.alternatives.map((a) => {
                  const isSel = sel === a.key;
                  return (
                    <button key={a.key} onClick={() => setAnswer(current.id, a.key)}
                      className={`w-full text-left p-4 rounded-lg border transition-all flex gap-3 ${
                        isSel ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/40"
                      }`}>
                      <span className="font-mono font-semibold text-primary">{a.key}</span>
                      <span className="flex-1">{a.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              {index < total - 1 ? (
                <Button onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} className="bg-gradient-primary text-primary-foreground">
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => setConfirmFinish(true)} className="bg-gradient-primary text-primary-foreground shadow-glow">
                  Encerrar simulado
                </Button>
              )}
            </div>
          </Card>

          {/* Navigator */}
          <Card className="bg-card-elegant border-border p-4 h-fit lg:sticky lg:top-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Navegação</div>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id];
                const isFlagged = flagged.has(q.id);
                const isCurrent = i === index;
                return (
                  <button key={q.id} onClick={() => setIndex(i)}
                    className={`relative aspect-square rounded text-xs font-mono border transition ${
                      isCurrent ? "border-primary ring-2 ring-primary/40" :
                      isAnswered ? "border-primary/50 bg-primary/15" :
                      "border-border hover:border-primary/40"
                    }`}>
                    {i + 1}
                    {isFlagged && <Flag className="h-2.5 w-2.5 text-gold absolute top-0.5 right-0.5" />}
                  </button>
                );
              })}
            </div>
            <Button onClick={() => setConfirmFinish(true)} variant="outline" className="w-full mt-4">
              Encerrar agora
            </Button>
          </Card>
        </div>

        <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar simulado?</AlertDialogTitle>
              <AlertDialogDescription>
                Você respondeu {answered} de {total} questões.
                {answered < total && (
                  <span className="block mt-2 text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> {total - answered} ainda em branco.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuar respondendo</AlertDialogCancel>
              <AlertDialogAction onClick={() => finish(false)}>Encerrar e ver resultado</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============ FINISHED ============
  const mcQuestions = questions.filter((q) => q.question_format !== "open_ended");
  const correctCount = mcQuestions.filter((q) => answers[q.id] === q.correct_alternative).length;
  const wrongCount = mcQuestions.filter((q) => answers[q.id] && answers[q.id] !== q.correct_alternative).length;
  const blankCount = mcQuestions.filter((q) => !answers[q.id]).length;
  const score = mcQuestions.length ? Math.round((correctCount / mcQuestions.length) * 100) : 0;

  // por matéria
  const byDisc = new Map<string, { c: number; t: number }>();
  mcQuestions.forEach((q) => {
    const e = byDisc.get(q.discipline) || { c: 0, t: 0 };
    e.t += 1;
    if (answers[q.id] === q.correct_alternative) e.c += 1;
    byDisc.set(q.discipline, e);
  });

  return (
    <div className="container max-w-4xl py-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl">Resultado</h1>
        <p className="text-muted-foreground">Confira o gabarito comentado abaixo.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-5 bg-card-elegant border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Aproveitamento</div>
          <div className="font-display text-4xl text-gradient mt-1">{score}%</div>
        </Card>
        <Card className="p-5 bg-card-elegant border-success/40">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Acertos</div>
          <div className="font-display text-4xl text-success mt-1">{correctCount}</div>
        </Card>
        <Card className="p-5 bg-card-elegant border-destructive/40">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Erros</div>
          <div className="font-display text-4xl text-destructive mt-1">{wrongCount}</div>
        </Card>
        <Card className="p-5 bg-card-elegant border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Em branco</div>
          <div className="font-display text-4xl text-muted-foreground mt-1">{blankCount}</div>
        </Card>
      </div>

      {byDisc.size > 0 && (
        <Card className="p-6 bg-card-elegant border-border">
          <h2 className="font-display text-xl mb-4">Desempenho por matéria</h2>
          <div className="space-y-3">
            {[...byDisc.entries()].map(([name, v]) => {
              const pct = Math.round((v.c / v.t) * 100);
              return (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="text-muted-foreground">{v.c}/{v.t} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={restartSameWrong} disabled={wrongCount === 0} className="bg-gradient-primary text-primary-foreground">
          <RotateCcw className="h-4 w-4 mr-2" /> Refazer apenas as erradas ({wrongCount})
        </Button>
        <Button variant="outline" onClick={reset}>Novo simulado</Button>
      </div>

      <div className="space-y-4 pt-4">
        <h2 className="font-display text-2xl">Gabarito comentado</h2>
        {questions.map((q, i) => {
          const sel = answers[q.id];
          const isOpen = q.question_format === "open_ended";
          const isCorrect = !isOpen && sel === q.correct_alternative;
          const isBlank = !sel;
          return (
            <Card key={q.id} className={`p-6 border ${
              isOpen ? "border-border" :
              isCorrect ? "border-success/40 bg-success/5" :
              isBlank ? "border-border" :
              "border-destructive/40 bg-destructive/5"
            }`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="outline">Q{i + 1}</Badge>
                <Badge variant="outline" className="border-primary/40 text-primary">{q.discipline}</Badge>
                {isOpen ? <Badge variant="outline">Dissertativa</Badge> :
                  isCorrect ? <Badge className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" />Correta</Badge> :
                  isBlank ? <Badge variant="secondary">Em branco</Badge> :
                  <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Incorreta</Badge>
                }
                {flagged.has(q.id) && <Badge variant="outline" className="border-gold text-gold"><Flag className="h-3 w-3 mr-1" />Marcada</Badge>}
              </div>
              <p className="text-sm md:text-base leading-relaxed mb-4 whitespace-pre-line">{q.statement}</p>

              {!isOpen && (
                <div className="space-y-1.5 mb-4">
                  {q.alternatives.map((a) => {
                    const isSel = sel === a.key;
                    const isRight = a.key === q.correct_alternative;
                    return (
                      <div key={a.key} className={`px-3 py-2 rounded border text-sm flex gap-2 ${
                        isRight ? "border-success bg-success/10" :
                        isSel ? "border-destructive bg-destructive/10" :
                        "border-border opacity-70"
                      }`}>
                        <span className="font-mono font-semibold">{a.key}</span>
                        <span className="flex-1">{a.text}</span>
                        {isRight && <Check className="h-4 w-4 text-success" />}
                        {isSel && !isRight && <X className="h-4 w-4 text-destructive" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {isOpen && sel && (
                <div className="mb-4 p-3 rounded border border-border bg-secondary/40 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Sua resposta:</div>
                  {sel}
                </div>
              )}
              {isOpen && q.expected_answer && (
                <div className="mb-4 p-3 rounded border border-primary/30 bg-primary/5 text-sm">
                  <div className="text-xs text-primary mb-1 uppercase tracking-wider">Gabarito esperado</div>
                  {q.expected_answer}
                </div>
              )}

              {q.explanation && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="text-xs uppercase tracking-wider text-primary mb-2">Comentário</div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{q.explanation}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Simulado;
