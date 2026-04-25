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
  const [originSearch, setOriginSearch] = useState("enamed");
  const [searchResults, setSearchResults] = useState<QuestionData[]>([]);
  const [genOrigin, setGenOrigin] = useState("enamed");
  const [genDiscipline, setGenDiscipline] = useState("");
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);
  const [transformOrigin, setTransformOrigin] = useState("enamed");
  const [clinicalCase, setClinicalCase] = useState("");
  const [transforming, setTransforming] = useState(false);
  const [transformed, setTransformed] = useState<any | null>(null);

  const search = async () => {
    const { data } = await supabase.from("questions").select("*").eq("origin", originSearch as any).eq("review_status", "approved");
    setSearchResults((data || []) as any);
  };

  const generate = async () => {
    setGenerating(true); setGenerated([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-questions", {
        body: { mode: "generate", origin: genOrigin, discipline: genDiscipline || undefined, count: genCount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGenerated((data as any).inserted || []);
      toast.success(`${(data as any).count} questão(ões) gerada(s) e enviadas para revisão.`);
    } catch (e: any) { toast.error(e.message || "Falha ao gerar"); }
    finally { setGenerating(false); }
  };

  const transform = async () => {
    if (!clinicalCase.trim()) return;
    setTransforming(true); setTransformed(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-questions", {
        body: { mode: "transform", origin: transformOrigin, clinicalCase },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTransformed((data as any).inserted?.[0] || null);
      toast.success("Questão criada e enviada para revisão.");
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
            <Label>Banca / origem</Label>
            <div className="flex gap-3 mt-2">
              <Select value={originSearch} onValueChange={setOriginSearch}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={search} className="bg-gradient-primary text-primary-foreground">Buscar</Button>
            </div>
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 text-sm text-muted-foreground">
              <span className="text-primary font-semibold">Estilo da banca: </span>{STYLE_NOTES[originSearch]}
            </div>
          </Card>
          {searchResults.map(q => <QuestionCard key={q.id} q={q} />)}
        </TabsContent>

        <TabsContent value="generate" className="mt-6">
          <Card className="bg-card-elegant border-border p-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>Banca-base</Label>
                <Select value={genOrigin} onValueChange={setGenOrigin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disciplina (opcional)</Label>
                <Input value={genDiscipline} onChange={e => setGenDiscipline(e.target.value)} placeholder="Ex.: Cardiologia" />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} max={10} value={genCount} onChange={e => setGenCount(Number(e.target.value))} />
              </div>
            </div>
            <Button onClick={generate} disabled={generating} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</> : "Gerar questões com IA"}
            </Button>
            <p className="text-xs text-muted-foreground">As questões geradas ficam com status <span className="text-primary">pendente de revisão</span> até serem aprovadas por um professor.</p>
          </Card>
          <div className="mt-6 space-y-4">
            {generated.map((g) => (
              <div key={g.id}>
                <div className="text-xs text-muted-foreground mb-2">
                  IA · confiança {(g._meta?.confidence * 100).toFixed(0)}% · status: pendente de revisão
                </div>
                <QuestionCard q={g as any} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transform" className="mt-6">
          <Card className="bg-card-elegant border-border p-6 space-y-4">
            <div>
              <Label>Banca alvo</Label>
              <Select value={transformOrigin} onValueChange={setTransformOrigin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Caso clínico</Label>
              <Textarea value={clinicalCase} onChange={e => setClinicalCase(e.target.value)} rows={6}
                placeholder="Cole ou descreva um cenário clínico…" />
            </div>
            <Button onClick={transform} disabled={transforming || !clinicalCase.trim()}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {transforming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Transformando…</> : "Transformar em questão"}
            </Button>
          </Card>
          {transformed && <div className="mt-6"><QuestionCard q={transformed as any} /></div>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Enamed;