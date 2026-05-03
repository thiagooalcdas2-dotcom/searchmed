import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Stethoscope, Sparkles, Library, Activity, ArrowRight } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-hero relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[820px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, hsl(var(--electric)/0.55), transparent)" }} />
      <header className="container relative flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-electric flex items-center justify-center shadow-electric">
            <Stethoscope className="h-5 w-5 text-electric-foreground" />
          </div>
          <span className="font-display text-xl tracking-tight">HealthQuest</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button className="bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium px-5">
              Entrar <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="container relative pt-24 pb-28 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-xs text-muted-foreground mb-8">
          <Sparkles className="h-3 w-3" style={{ color: "hsl(var(--electric))" }} /> IA assistida · revisão obrigatória
        </div>
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl mx-auto">
          Estude medicina como se já estivesse <span style={{ color: "hsl(var(--electric))" }}>na prova.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6">
          Banco curado para ENAMED e residências do Sul de Minas e São Paulo. Simulados sob medida e raciocínio clínico em primeiro lugar.
        </p>
        <div className="flex items-center justify-center gap-3 mt-10">
          <Link to="/auth">
            <Button size="lg" className="bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium">
              Entrar agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features"><Button size="lg" variant="ghost">Conhecer recursos</Button></a>
        </div>
      </section>

      <section id="features" className="container relative pb-32 grid md:grid-cols-3 gap-6">
        {[
          { icon: Library, title: "Banco curado", body: "Questões com gabarito comentado, distratores plausíveis e controle anti-viés de comprimento." },
          { icon: Sparkles, title: "IA por banca", body: "Geração inspirada nos padrões de ENAMED, Itajubá, Alfenas, Pouso Alegre, Lavras e SP." },
          { icon: Activity, title: "Desempenho real", body: "Acompanhe acertos por disciplina e identifique lacunas com clareza." },
        ].map((f) => (
          <div
            key={f.title}
            className="group relative bg-card-elegant border border-border rounded-2xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-electric"
          >
            <div className="h-10 w-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-electric/20">
              <f.icon className="h-5 w-5" style={{ color: "hsl(var(--electric))" }} />
            </div>
            <h3 className="font-display text-xl mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HealthQuest · Plataforma de estudo. Todas as questões são originais — não reproduzimos provas reais protegidas.
      </footer>
    </div>
  );
};

export default Landing;