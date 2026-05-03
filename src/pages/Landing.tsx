import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, BookOpen, Library, Activity, Quote } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-hero">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl">HealthQuest</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Entrar</Button></Link>
        </div>
      </header>

      <section className="container pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-xs text-muted-foreground mb-8">
          <Sparkles className="h-3 w-3 text-primary" /> Geração de questões assistida por IA · revisão obrigatória
        </div>
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl mx-auto">
          Estude medicina como se já estivesse <span className="text-gradient">na prova.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6">
          Banco de questões originais para ENAMED, residências do Sul de Minas (Itajubá, Alfenas, Pouso Alegre, Lavras) e São Paulo. Simulados sob medida, comentários comparativos e raciocínio clínico em primeiro lugar.
        </p>
        <div className="flex items-center justify-center gap-3 mt-10">
          <a href="#features"><Button size="lg" variant="outline">Conhecer recursos</Button></a>
        </div>
      </section>

      <section id="features" className="container pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Library, title: "Banco curado", body: "Questões com gabarito comentado, distratores plausíveis e controle anti-viés de comprimento." },
          { icon: Sparkles, title: "IA por banca", body: "Geração inspirada nos padrões de ENAMED, Itajubá, Alfenas, Pouso Alegre, Lavras e SP." },
          { icon: Activity, title: "Desempenho real", body: "Acompanhe acertos por disciplina e identifique lacunas com clareza." },
        ].map((f) => (
          <div key={f.title} className="bg-card-elegant border border-border rounded-2xl p-6 shadow-soft">
            <f.icon className="h-6 w-6 text-primary mb-4" />
            <h3 className="font-display text-xl mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="container pb-32 text-center">
        <Quote className="h-8 w-8 mx-auto text-primary mb-4 opacity-60" />
        <p className="font-display text-2xl md:text-3xl max-w-3xl mx-auto leading-snug">
          “Não basta saber medicina — é preciso responder do jeito que a banca pergunta.”
        </p>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HealthQuest · Plataforma de estudo. Todas as questões são originais — não reproduzimos provas reais protegidas.
      </footer>
    </div>
  );
};

export default Landing;