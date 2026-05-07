import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, Sparkles, Library, Activity, ArrowRight, Brain, MessageSquare,
  Repeat, Users, Trophy, Check, Zap, ShieldCheck, Clock, Target, BookOpen,
  LineChart, Bot,
} from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-hero relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[820px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, hsl(var(--electric)/0.55), transparent)" }} />

      {/* Header */}
      <header className="container relative flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-electric flex items-center justify-center shadow-electric">
            <Stethoscope className="h-5 w-5 text-electric-foreground" />
          </div>
          <span className="font-display text-xl tracking-tight">HealthQuest</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#recursos" className="hover:text-foreground transition">Recursos</a>
          <a href="#ia" className="hover:text-foreground transition">IA integrada</a>
          <a href="#hub" className="hover:text-foreground transition">Hub</a>
          <a href="#planos" className="hover:text-foreground transition">Planos</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button className="bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium px-5">
              Entrar <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container relative pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-xs text-muted-foreground mb-8">
          <Sparkles className="h-3 w-3" style={{ color: "hsl(var(--electric))" }} />
          Plataforma com IA integrada · graduação · ENAMED · residência
        </div>
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl mx-auto">
          Estude medicina como se já estivesse <span style={{ color: "hsl(var(--electric))" }}>na prova.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6">
          Banco de questões curado, simulados sob medida, caderno de erros com revisão espaçada e uma IA que tira suas dúvidas em qualquer tela — tudo num único lugar, sem complicação.
        </p>
        <div className="flex items-center justify-center gap-3 mt-10">
          <Link to="/auth">
            <Button size="lg" className="bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium">
              Começar agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#recursos"><Button size="lg" variant="ghost">Ver como funciona</Button></a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: "hsl(var(--electric))" }} /> Sem fidelidade</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: "hsl(var(--electric))" }} /> Cancele quando quiser</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: "hsl(var(--electric))" }} /> IA inclusa em todos os módulos</span>
        </div>
      </section>

      {/* Para quem é */}
      <section className="container relative pb-20">
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <div className="bg-card-elegant border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5" style={{ color: "hsl(var(--electric))" }} />
              <h3 className="font-display text-xl">Para a graduação</h3>
            </div>
            <p className="text-sm text-muted-foreground">Avaliações internas, ENAMED e progress tests. Estude por matéria, monte simulados rápidos entre uma aula e outra e identifique exatamente onde está perdendo ponto.</p>
          </div>
          <div className="bg-card-elegant border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5" style={{ color: "hsl(var(--electric))" }} />
              <h3 className="font-display text-xl">Para a residência</h3>
            </div>
            <p className="text-sm text-muted-foreground">Provas comentadas, simulados no formato real e caderno de erros com revisão espaçada — você revisita na hora certa o que tem mais chance de cair.</p>
          </div>
        </div>
      </section>

      {/* Diferenciais (recursos) */}
      <section id="recursos" className="container relative pb-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="outline" className="mb-3">Recursos</Badge>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Tudo que você precisa para estudar de verdade</h2>
          <p className="text-muted-foreground mt-4">Sem abas espalhadas, sem PDF perdido, sem planilha de revisão. Uma única plataforma do primeiro estudo até a prova.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Library, title: "Banco gigante e crescente", body: "Questões organizadas por disciplina, tópico e dificuldade. Filtros em cascata para você focar exatamente onde precisa." },
            { icon: BookOpen, title: "Simulados sob medida", body: "Monte em segundos pelo número de questões, matérias e nível. Receba a correção comentada no fim." },
            { icon: Repeat, title: "Caderno de erros com SRS", body: "Cada erro vira uma revisão programada. A plataforma decide quando você precisa rever, baseado em ciência da memória." },
            { icon: Bot, title: "IA tutor 24h", body: "Ficou com dúvida em qualquer tela? O assistente flutuante explica a opção, o conceito clínico ou qualquer coisa fora do curso." },
            { icon: Users, title: "Hub de estudantes", body: "Converse com colegas de outras faculdades, troque resumos, tire dúvidas e estude em rede — não sozinho." },
            { icon: LineChart, title: "Desempenho real", body: "Heatmap por matéria × dificuldade, evolução diária, ranking, streak. Você vê o progresso, não só sente." },
          ].map((f) => (
            <div key={f.title} className="group relative bg-card-elegant border border-border rounded-2xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-electric">
              <div className="h-10 w-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-electric/20">
                <f.icon className="h-5 w-5" style={{ color: "hsl(var(--electric))" }} />
              </div>
              <h3 className="font-display text-xl mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IA em destaque */}
      <section id="ia" className="container relative pb-24">
        <div className="grid md:grid-cols-2 gap-10 items-center bg-card-elegant border border-border rounded-3xl p-8 md:p-12">
          <div>
            <Badge className="mb-3 bg-electric/15 text-electric border-electric/30 hover:bg-electric/15">IA integrada</Badge>
            <h2 className="font-display text-4xl tracking-tight mb-4">Uma IA que estuda <span style={{ color: "hsl(var(--electric))" }}>com você</span> — não no lugar de você</h2>
            <p className="text-muted-foreground mb-6">A IA do HealthQuest está em todas as telas. Você abre, pergunta, ela responde — sobre a questão, sobre o conceito, sobre a vida. Sem precisar trocar de aba ou pagar outra assinatura.</p>
            <ul className="space-y-3 text-sm">
              {[
                ["Explica a alternativa correta e por que as outras estão erradas", MessageSquare],
                ["Resume um tópico inteiro em segundos quando você não lembra", Brain],
                ["Tira qualquer dúvida — clínica, de estudo ou aleatória", Sparkles],
                ["Disponível 24h, sem limite por questão", Zap],
              ].map(([txt, Icon]: any) => (
                <li key={txt} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-lg bg-electric/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: "hsl(var(--electric))" }} />
                  </div>
                  <span className="text-foreground/90">{txt}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-electric/20 blur-3xl rounded-full opacity-40" />
            <div className="relative bg-background border border-border rounded-2xl p-5 shadow-elegant">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-electric/15 flex items-center justify-center">
                  <Bot className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} />
                </div>
                <div>
                  <div className="text-sm font-semibold">MedQuest AI</div>
                  <div className="text-[11px] text-muted-foreground">Sempre online</div>
                </div>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                <div className="flex justify-end"><div className="bg-electric text-electric-foreground rounded-2xl rounded-br-sm px-3 py-2 max-w-[80%]">Por que a alternativa B é a errada nessa de cardio?</div></div>
                <div className="flex justify-start"><div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%]">Porque ela descreve um quadro de IC <em>direita</em>, e o caso traz dispneia paroxística noturna + estertores bibasais — clássico de IC <em>esquerda</em>. Quer que eu te dê 3 questões parecidas?</div></div>
                <div className="flex justify-end"><div className="bg-electric text-electric-foreground rounded-2xl rounded-br-sm px-3 py-2 max-w-[80%]">Manda</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hub */}
      <section id="hub" className="container relative pb-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Ana M.", school: "USP-RP", msg: "Alguém topa simulado de pediatria hoje?" },
                { name: "Diego R.", school: "UFMG", msg: "Caí na pegadinha de eletro de novo 😅" },
                { name: "Carla S.", school: "Unifesp", msg: "Compartilhei resumo de SCA no grupo" },
                { name: "João P.", school: "Famema", msg: "Subi 12 posições no ranking essa semana" },
              ].map((u) => (
                <div key={u.name} className="bg-card-elegant border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-full bg-electric/15 flex items-center justify-center text-[10px] font-bold" style={{ color: "hsl(var(--electric))" }}>{u.name.split(" ").map(s=>s[0]).join("")}</div>
                    <div className="text-xs"><div className="font-semibold leading-tight">{u.name}</div><div className="text-muted-foreground">{u.school}</div></div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{u.msg}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <Badge variant="outline" className="mb-3">Hub</Badge>
            <h2 className="font-display text-4xl tracking-tight mb-4">Estudar sozinho cansa. <span style={{ color: "hsl(var(--electric))" }}>Aqui você não está.</span></h2>
            <p className="text-muted-foreground mb-6">Conecte-se com estudantes do Brasil inteiro. Conversas privadas, perfis, ranking público (se você quiser) e troca de experiências de quem está passando pela mesma prova que você.</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} /> DM com colegas</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} /> Perfis e badges</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} /> Ranking opt-in</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "hsl(var(--electric))" }} /> Privacidade total</div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="container relative pb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3">Em 3 passos</Badge>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Do cadastro à primeira melhora real</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Crie sua conta", d: "Em menos de 1 minuto. E-mail e pronto, sem cartão obrigatório para explorar." },
            { n: "02", t: "Resolva e erre", d: "Comece pelo banco ou monte um simulado. Cada erro entra no caderno automaticamente." },
            { n: "03", t: "Acompanhe e melhore", d: "O painel mostra exatamente o que revisar. A IA explica o que você não entendeu." },
          ].map((s) => (
            <div key={s.n} className="bg-card-elegant border border-border rounded-2xl p-6">
              <div className="font-display text-3xl mb-3" style={{ color: "hsl(var(--electric))" }}>{s.n}</div>
              <div className="font-display text-xl mb-2">{s.t}</div>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="container relative pb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3">Planos</Badge>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Um plano. Tudo incluso.</h2>
          <p className="text-muted-foreground mt-4">Sem upsell de IA, sem módulo travado, sem letra miúda. Você assina e usa tudo.</p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="relative bg-card-elegant border-2 border-electric/40 rounded-3xl p-8 shadow-electric">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-electric text-electric-foreground hover:bg-electric">Mais popular</Badge>
            </div>
            <div className="text-center mb-6">
              <div className="font-display text-2xl">Plano Mensal</div>
              <div className="text-sm text-muted-foreground mt-1">Acesso completo. Cancele quando quiser.</div>
            </div>
            <ul className="space-y-3 text-sm mb-8">
              {[
                "Banco de questões completo e crescente",
                "Simulados ilimitados",
                "Caderno de erros com revisão espaçada",
                "MedQuest AI 24h em todas as telas",
                "Hub com outros estudantes e DMs",
                "Ranking e estatísticas detalhadas",
                "Atualizações constantes sem custo extra",
              ].map((it) => (
                <li key={it} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-electric/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" style={{ color: "hsl(var(--electric))" }} />
                  </div>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth" className="block">
              <Button size="lg" className="w-full bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium">
                Começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-[11px] text-muted-foreground text-center mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Pagamento seguro · Cancele em 1 clique
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container relative pb-24 max-w-3xl">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3">Perguntas frequentes</Badge>
          <h2 className="font-display text-4xl tracking-tight">Ainda em dúvida?</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: "A IA realmente responde qualquer dúvida?", a: "Sim. Ela é especialista no conteúdo médico e na plataforma, mas você pode perguntar qualquer outra coisa também — desde dúvidas de estudo até temas fora do curso." },
            { q: "Funciona para a graduação ou só residência?", a: "Os dois. O banco cobre desde matérias do ciclo básico até as grandes áreas cobradas em ENAMED, USP, Unifesp e residências em geral." },
            { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem fidelidade, sem multa, sem ligação. O cancelamento é direto pelo painel da sua conta." },
            { q: "Preciso instalar algum app?", a: "Não. Funciona direto no navegador, no celular ou no computador, com sincronização automática." },
            { q: "Meus dados ficam visíveis para outros estudantes?", a: "Você decide. Pode aparecer no ranking e no hub, ou manter tudo privado — controle total nas configurações." },
          ].map((f) => (
            <details key={f.q} className="group bg-card-elegant border border-border rounded-2xl p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-medium">
                {f.q}
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="container relative pb-24">
        <div className="relative overflow-hidden bg-card-elegant border border-electric/30 rounded-3xl p-10 md:p-14 text-center">
          <div aria-hidden className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at center, hsl(var(--electric)/0.4), transparent 60%)" }} />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl tracking-tight max-w-2xl mx-auto">
              A próxima prova é <span style={{ color: "hsl(var(--electric))" }}>sua</span>. Comece hoje.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">Cadastre-se em menos de 1 minuto e veja por que cada vez mais estudantes estão migrando para o HealthQuest.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="bg-electric text-electric-foreground hover:bg-electric-glow shadow-electric font-medium">
                  Criar minha conta <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HealthQuest · Plataforma de estudo. Todas as questões são originais — não reproduzimos provas reais protegidas.
      </footer>
    </div>
  );
};

export default Landing;