import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COURSE_YEARS = [
  { v: "geral", l: "Geral / todos os anos" },
  { v: "ano_1", l: "1º ano" },
  { v: "ano_2", l: "2º ano" },
  { v: "ano_3", l: "3º ano" },
  { v: "ano_4", l: "4º ano" },
  { v: "ano_5", l: "5º ano" },
  { v: "ano_6", l: "6º ano" },
  { v: "residencia", l: "Residência" },
] as const;

export const DIFFICULTIES = [
  { v: "all", l: "Todas as dificuldades" },
  { v: "easy", l: "Simples" },
  { v: "medium", l: "Mediana" },
  { v: "hard", l: "Difícil" },
] as const;

export type CascadeValue = {
  year: string;        // course_year enum or "geral"
  discipline: string;  // discipline name or "all"
  difficulty: string;  // easy|medium|hard|all
};

export const CascadeFilter = ({
  value,
  onChange,
  showDifficulty = true,
}: {
  value: CascadeValue;
  onChange: (v: CascadeValue) => void;
  showDifficulty?: boolean;
}) => {
  const [disciplines, setDisciplines] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (value.year === "geral") {
        const { data } = await supabase.from("disciplines").select("name").order("name");
        setDisciplines((data || []).map((d: any) => d.name));
        return;
      }
      const { data } = await supabase
        .from("discipline_years")
        .select("discipline_id, disciplines(name)")
        .eq("course_year", value.year as any);
      const names = Array.from(
        new Set((data || []).map((d: any) => d.disciplines?.name).filter(Boolean))
      ).sort();
      // Fallback: if no mapping yet, show all disciplines so the UI is usable
      if (names.length === 0) {
        const { data: all } = await supabase.from("disciplines").select("name").order("name");
        setDisciplines((all || []).map((d: any) => d.name));
      } else {
        setDisciplines(names);
      }
    })();
  }, [value.year]);

  return (
    <div className={`grid gap-3 ${showDifficulty ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      <div>
        <Label>Ano</Label>
        <Select
          value={value.year}
          onValueChange={(year) => onChange({ ...value, year, discipline: "all" })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {COURSE_YEARS.map((y) => (
              <SelectItem key={y.v} value={y.v}>{y.l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Matéria</Label>
        <Select
          value={value.discipline}
          onValueChange={(discipline) => onChange({ ...value, discipline })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {value.year === "geral" ? "Todas as matérias" : "Geral (todas do ano)"}
            </SelectItem>
            {disciplines.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDifficulty && (
        <div>
          <Label>Dificuldade</Label>
          <Select
            value={value.difficulty}
            onValueChange={(difficulty) => onChange({ ...value, difficulty })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};