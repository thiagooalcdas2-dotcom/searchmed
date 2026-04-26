import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowRight, Sparkles, Library, BookOpen, TrendingUp, Repeat } from "lucide-react";

const modules = [
  { to: "/app/simulado", icon: BookOpen, title: "Simulados", body: "Monte simulados por ano, matéria e dificuldade." },
  { to: "/app/banco", icon: Library, title: "Banco de questões", body: "Explore as questões filtradas em cascata." },
  { to: "/app/enamed", icon: Sparkles, title: "ENAMED & Residência", body: "Provas oficiais, IA inéditas e casos clínicos." },
  { to: "/app/revisar", icon: Repeat, title: "Caderno de erros", body: "Revisão espaçada das questões que você errou." },
  { to: "/app/desempenho", icon: TrendingUp, title: "Meu desempenho", body: "Estatísticas, ranking e evolução por matéria." },
];

const Home = () => {
  return (
    <div className="container max-w-5xl py-16">
      <div className="mb-14 text-center">
        <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
        <h1 className="font-display text-4xl md:text-5xl mt-2">Por onde começamos hoje?</h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {modules.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="bg-card-elegant border-border p-8 h-full hover:border-primary/50 hover:shadow-glow transition-all group">
              <c.icon className="h-7 w-7 text-primary mb-4" />
              <h3 className="font-display text-2xl mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground mb-5">{c.body}</p>
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