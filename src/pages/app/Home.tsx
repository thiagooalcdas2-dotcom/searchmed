import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Sparkles, Library, BookOpen } from "lucide-react";

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, attempts: 0, accuracy: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: total }, { data: attempts }] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }).eq("review_status", "approved"),
        supabase.from("question_attempts").select("is_correct").eq("user_id", user!.id),
      ]);
      const att = attempts || [];
      const acc = att.length ? Math.round((att.filter((a: any) => a.is_correct).length / att.length) * 100) : 0;
      setStats({ total: total || 0, attempts: att.length, accuracy: acc });
    })();
  }, [user]);

  return (
    <div className="container max-w-6xl py-12">
      <div className="mb-12">
        <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
        <h1 className="font-display text-4xl md:text-5xl mt-1">Pronto para a próxima questão?</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {[
          { label: "Questões disponíveis", value: stats.total },
          { label: "Suas respostas", value: stats.attempts },
          { label: "Aproveitamento", value: `${stats.accuracy}%` },
        ].map((s) => (
          <Card key={s.label} className="bg-card-elegant border-border p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="font-display text-4xl mt-2 text-gradient">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { to: "/app/banco", icon: Library, title: "Explorar banco", body: "Filtre questões por disciplina, banca e dificuldade." },
          { to: "/app/simulado", icon: BookOpen, title: "Montar simulado", body: "Crie um simulado personalizado em segundos." },
          { to: "/app/enamed", icon: Sparkles, title: "ENAMED & Residência", body: "Aba especial com IA geradora por banca." },
        ].map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="bg-card-elegant border-border p-6 h-full hover:border-primary/50 hover:shadow-glow transition-all group">
              <c.icon className="h-6 w-6 text-primary mb-4" />
              <h3 className="font-display text-xl mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{c.body}</p>
              <div className="text-sm text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                Abrir <ArrowRight className="h-4 w-4" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;