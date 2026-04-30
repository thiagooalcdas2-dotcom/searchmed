import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionCard, QuestionData } from "@/components/QuestionCard";
import { QuestionPager } from "@/components/QuestionPager";
import { CascadeFilter, CascadeValue } from "@/components/CascadeFilter";
import { Sparkles, Search, Wand2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ORIGINS = [
  { v: "enamed", l: "ENAMED" },
  { v: "residencia_itajuba", l: "Residência · Itajubá" },
  { v: "residencia_alfenas", l: "Residência · Alfenas" },
  { v: "residencia_pouso_alegre", l: "Residência · Pouso Alegre" },
  { v: "residencia_lavras", l: "Residência · Lavras" },
  { v: "residencia_sp_usp", l: "SP · estilo USP" },
  { v: "residencia_sp_santa_casa", l: "SP · Santa Casa" },
  { v: "residencia_sp_outros", l: "SP · outros hospitais" },
];

const STYLE_NOTES: Record<string, string> = {
  enamed: "Distribuição equilibrada entre Clínica, Cirurgia, Pediatria, GO, Saúde Coletiva e MFC. Casos clínicos longos com foco em conduta baseada em diretrizes brasileiras (MS, SBC, FEBRASGO).",
  residencia_itajuba: "Tendência a casos clínicos objetivos, ênfase em clínica médica e GO. Costuma cobrar conduta de PS e diretrizes nacionais.",
  residencia_alfenas: "Provas com peso em saúde coletiva, MFC e pediatria. Enunciados de tamanho médio.",
  residencia_pouso_alegre: "Univás — questões diretas, com diferenciação fina entre diagnósticos próximos. Boa prevalência de cardiologia e infectologia.",
  residencia_lavras: "UFLA — provas com forte componente de medicina preventiva e atenção primária; cuidado com pegadinhas de SUS.",
  residencia_sp_usp: "Estilo USP: casos clínicos longos, foco em raciocínio fisiopatológico e exames complementares de alta complexidade.",
  residencia_sp_santa_casa: "Santa Casa: foco em emergências, condutas práticas e protocolos hospitalares.",
  residencia_sp_outros: "Hospitais de ensino de SP: misto, ênfase em cirurgia e clínica.",
};

const Enamed = () => {
  // Busca por banca (oficiais)
  const [originSearch, setOriginSearch] = useState("enamed");
  const [searchFilter, setSearchFilter] = useState<CascadeValue>({ year: "geral", discipline: "all", difficulty: "all" });
  const [searchResults, setSearchResults] = useState<QuestionData[]>([]);

  // Geração de inéditas IA
  const [genOrigin, setGenOrigin] = useState("enamed");
  const [genFilter, setGenFilter] = useState<CascadeValue>({ year: "residencia", discipline: "all", difficulty: "medium" });
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);

  // Caso clínico → questão
  const [transformOrigin, setTransformOrigin] = useState("enamed");
  const [transformFilter, setTransformFilter] = useState<CascadeValue>({ year: "residencia", discipline: "all", difficulty: "medium" });
  const [clinicalCase, setClinicalCase] = useState("");
  const [transforming, setTransforming] = useState(false);
  const [transformed, setTransformed] = useState<any | null>(null);

  const search = async () => {
    let q = supabase
      .from("questions")
      .select("*")
      .eq("origin", originSearch as any)
      .eq("review_status", "approved")
      .eq("is_ai_unofficial", false); // banca oficial: nunca trazer IA
    if (searchFilter.year !== "geral") q = q.eq("course_year", searchFilter.year as any);
    if (searchFilter.discipline !== "all") q = q.eq("discipline", searchFilter.discipline);
    if (searchFilter.difficulty !== "all") q = q.eq("difficulty", searchFilter.difficulty as any);
    const { data } = await q;
    setSearchResults((data || []) as any);
  };

  const generate = async () => {
    setGenerating(true); setGenerated([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-questions", {
        body: {
          mode: "generate",
          origin: genOrigin,
          discipline: genFilter.discipline !== "all" ? genFilter.discipline : undefined,
          course_year: genFilter.year,
          difficulty: genFilter.difficulty !== "all" ? genFilter.difficulty : undefined,
          count: genCount,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGenerated((data as any).inserted || []);
      toast.success(`${(data as any).count} questão(ões) inédita(s) gerada(s) — marcadas como IA, não oficial.`);
    } catch (e: any) { toast.error(e.message || "Falha ao gerar"); }
    finally { setGenerating(false); }
  };

  const transform = async () => {
    if (!clinicalCase.trim()) return;
    setTransforming(true); setTransformed(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-questions", {
        body: {
          mode: "transform",
          origin: transformOrigin,
          discipline: transformFilter.discipline !== "all" ? transformFilter.discipline : undefined,
          course_year: transformFilter.year,
          difficulty: transformFilter.difficulty !== "all" ? transformFilter.difficulty : undefined,
          clinicalCase,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTransformed((data as any).inserted?.[0] || null);
      toast.success("Questão criada (IA — não oficial).");
    } catch (e: any) { toast.error(e.message || "Falha"); }
    finally { setTransforming(false); }
  };

  return (
    <div className="container max-w-5xl py-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl">ENAMED & Residência <span className="text-muted-foreground text-base">(Sul de Minas + SP)</span></h1>
        </div>
      </div>
      <p className="text-muted-foreground mb-8">Banco filtrado por banca e o gerador avançado de questões com IA.</p>

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="search"><Search className="h-4 w-4 mr-2" />Buscar por banca</TabsTrigger>
          <TabsTrigger value="generate"><Wand2 className="h-4 w-4 mr-2" />Gerar novas</TabsTrigger>
          <TabsTrigger value="transform"><FileText className="h-4 w-4 mr-2" />Caso clínico → questão</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4 mt-6">
          <Card className="bg-card-elegant border-border p-6">
            <div className="space-y-4">
              <div>
                <Label>Banca / origem</Label>
                <Select value={originSearch} onValueChange={setOriginSearch}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <CascadeFilter value={searchFilter} onChange={setSearchFilter} />
              <Button onClick={search} className="w-full bg-gradient-primary text-primary-foreground">Buscar questões oficiais</Button>
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 text-sm text-muted-foreground">
                <span className="text-primary font-semibold">Estilo da banca: </span>{STYLE_NOTES[originSearch]}
              </div>
              <div className="p-4 rounded-lg border border-border bg-secondary/40 text-xs text-muted-foreground">
                Esta aba mostra somente questões <strong>oficiais importadas</strong>. Enquanto não houver provas importadas para os filtros escolhidos, a lista pode aparecer vazia. Use a aba <em>Gerar inéditas (IA)</em> para questões inspiradas no estilo.
              </div>
            </div>
          </Card>
          {searchResults.length > 0 && (
            <QuestionPager
              key={`search-${originSearch}-${searchFilter.year}-${searchFilter.discipline}-${searchFilter.difficulty}`}
              questions={searchResults}
              emptyMessage="Nenhuma questão oficial encontrada para esse filtro."
            />
          )}
        </TabsContent>

        <TabsContent value="generate" className="mt-6">
          <Card className="bg-card-elegant border-border p-6 space-y-4">
            <div>
              <Label>Banca-base (estilo)</Label>
              <Select value={genOrigin} onValueChange={setGenOrigin}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <CascadeFilter value={genFilter} onChange={setGenFilter} />
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} max={10} value={genCount} onChange={e => setGenCount(Number(e.target.value))} />
            </div>
            <Button onClick={generate} disabled={generating} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</> : "Gerar inéditas com IA"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Estas questões são <strong>inéditas, geradas por IA</strong>, e ficam marcadas como <span className="text-destructive">IA — não oficial</span>. Vão para revisão antes de aparecerem no banco oficial.
            </p>
          </Card>
          {generated.length > 0 && (
            <div className="mt-6">
              <div className="text-xs text-muted-foreground mb-2">
                {generated.length} questão(ões) IA · navegue pelo painel ao lado.
              </div>
              <QuestionPager
                key={`gen-${generated.length}`}
                questions={generated as any}
                emptyMessage="Nenhuma questão gerada ainda."
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="transform" className="mt-6">
          <Card className="bg-card-elegant border-border p-6 space-y-4">
            <div>
              <Label>Banca alvo (estilo)</Label>
              <Select value={transformOrigin} onValueChange={setTransformOrigin}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <CascadeFilter value={transformFilter} onChange={setTransformFilter} />
            <div>
              <Label>Caso clínico</Label>
              <Textarea value={clinicalCase} onChange={e => setClinicalCase(e.target.value)} rows={6}
                placeholder="Cole ou descreva um cenário clínico…" />
            </div>
            <Button onClick={transform} disabled={transforming || !clinicalCase.trim()}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {transforming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Transformando…</> : "Transformar em questão"}
            </Button>
            <p className="text-xs text-muted-foreground">Resultado fica marcado como <span className="text-destructive">IA — não oficial</span>.</p>
          </Card>
          {transformed && <div className="mt-6"><QuestionCard key={transformed.id} q={transformed as any} /></div>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Enamed;