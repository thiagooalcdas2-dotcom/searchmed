import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const ORIGINS = [
  { v: "residencia_itajuba", l: "Residência — Itajubá" },
  { v: "residencia_alfenas", l: "Residência — Alfenas" },
  { v: "residencia_pouso_alegre", l: "Residência — Pouso Alegre" },
  { v: "residencia_lavras", l: "Residência — Lavras" },
  { v: "residencia_sp_usp", l: "Residência — SP USP" },
  { v: "residencia_sp_santa_casa", l: "Residência — SP Santa Casa" },
  { v: "residencia_sp_outros", l: "Residência — SP outros" },
  { v: "enamed", l: "ENAMED" },
  { v: "internal", l: "Interna / outras" },
];

const YEARS = [
  { v: "ano_1", l: "1º ano" },
  { v: "ano_2", l: "2º ano" },
  { v: "ano_3", l: "3º ano" },
  { v: "ano_4", l: "4º ano" },
  { v: "ano_5", l: "5º ano" },
  { v: "ano_6", l: "6º ano" },
  { v: "residencia", l: "Residência" },
  { v: "geral", l: "Geral" },
];

export const ImportExam = ({ onImported }: { onImported?: () => void }) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [origin, setOrigin] = useState("residencia_itajuba");
  const [courseYear, setCourseYear] = useState("residencia");
  const [refYear, setRefYear] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!text.trim() && files.length === 0) {
      toast.error("Cole um texto ou anexe ao menos um arquivo.");
      return;
    }
    setBusy(true);
    try {
      // 1. upload arquivos
      const paths: string[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${origin}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from("exam-imports").upload(path, f, { upsert: false });
        if (error) throw error;
        paths.push(path);
      }

      // 2. invoca extrator
      const { data, error } = await supabase.functions.invoke("ai-import-exam", {
        body: {
          text: text.trim() || undefined,
          file_paths: paths,
          origin,
          course_year: courseYear,
          reference_year: refYear ? Number(refYear) : null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const ins = (data as any).inserted || 0;
      toast.success(`${ins} questão(ões) extraída(s) e enviada(s) para revisão.`);
      setText("");
      setFiles([]);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message || "Falha no import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Origem da prova</Label>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ORIGINS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ano do curso</Label>
          <Select value={courseYear} onValueChange={setCourseYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y.v} value={y.v}>{y.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ano de referência (opcional)</Label>
          <Input type="number" placeholder="2024" value={refYear} onChange={(e) => setRefYear(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Cole o texto da prova</Label>
        <Textarea
          rows={8}
          placeholder="Cole o texto da prova aqui — ou deixe em branco e anexe PDFs/imagens abaixo."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div>
        <Label>Arquivos (PDF, JPG, PNG, WEBP)</Label>
        <label className="mt-2 flex items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary transition">
          <input type="file" multiple accept=".pdf,image/*" onChange={onPick} className="hidden" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span>Clique para anexar PDFs ou prints da prova</span>
          </div>
        </label>
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between bg-muted rounded px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 shrink-0" />{f.name} <span className="text-muted-foreground">({Math.round(f.size/1024)} KB)</span></span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
        {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extraindo questões…</> : "Extrair e enviar para revisão"}
      </Button>
      <p className="text-xs text-muted-foreground">
        As questões extraídas entram como <strong>pendentes de revisão</strong>. Aprove na aba "Revisão" antes de ficarem disponíveis aos alunos.
      </p>
    </Card>
  );
};