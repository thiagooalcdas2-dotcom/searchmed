
-- 1) Novos enums
DO $$ BEGIN
  CREATE TYPE public.course_year AS ENUM ('ano_1','ano_2','ano_3','ano_4','ano_5','ano_6','residencia','geral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_format AS ENUM ('multiple_choice','open_ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.exam_board AS ENUM (
    'none','sp_usp','sp_unifesp','sp_santa_casa','sp_outros',
    'mg_itajuba','mg_alfenas','mg_pouso_alegre','mg_lavras','enamed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novos campos na tabela questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS course_year public.course_year NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS question_format public.question_format NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS exam_board public.exam_board NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_ai_unofficial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_answer text;

CREATE INDEX IF NOT EXISTS idx_questions_course_year ON public.questions(course_year);
CREATE INDEX IF NOT EXISTS idx_questions_discipline ON public.questions(discipline);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_exam_board ON public.questions(exam_board);

-- 3) Tabela de matérias padronizadas
CREATE TABLE IF NOT EXISTS public.disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disciplines read all" ON public.disciplines;
CREATE POLICY "disciplines read all" ON public.disciplines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "disciplines manage admin" ON public.disciplines;
CREATE POLICY "disciplines manage admin" ON public.disciplines
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'professor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'professor'));

-- 4) Tabela de associação ano ↔ matéria
CREATE TABLE IF NOT EXISTS public.discipline_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  course_year public.course_year NOT NULL,
  UNIQUE (discipline_id, course_year)
);

ALTER TABLE public.discipline_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discipline_years read all" ON public.discipline_years;
CREATE POLICY "discipline_years read all" ON public.discipline_years
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "discipline_years manage admin" ON public.discipline_years;
CREATE POLICY "discipline_years manage admin" ON public.discipline_years
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'professor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'professor'));

-- 5) Seed das matérias e seus anos sugeridos
WITH d(name, slug, years) AS (
  VALUES
    ('Bioquímica','bioquimica', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Anatomia Humana','anatomia', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Fisiologia','fisiologia', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Histologia','histologia', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Biologia Celular e Molecular','biologia-celular', ARRAY['ano_1']::public.course_year[]),
    ('Embriologia','embriologia', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Microbiologia e Parasitologia','microbiologia', ARRAY['ano_2','ano_3']::public.course_year[]),
    ('Imunologia','imunologia', ARRAY['ano_2','ano_3']::public.course_year[]),
    ('Patologia','patologia', ARRAY['ano_2','ano_3']::public.course_year[]),
    ('Farmacologia','farmacologia', ARRAY['ano_2','ano_3']::public.course_year[]),
    ('Epidemiologia','epidemiologia', ARRAY['ano_2','ano_3','ano_4']::public.course_year[]),
    ('Pediatria','pediatria', ARRAY['ano_4','ano_5','ano_6','residencia']::public.course_year[]),
    ('Clínica Médica','clinica-medica', ARRAY['ano_3','ano_4','ano_5','ano_6','residencia']::public.course_year[]),
    ('Cirurgia','cirurgia', ARRAY['ano_4','ano_5','ano_6','residencia']::public.course_year[]),
    ('Psiquiatria','psiquiatria', ARRAY['ano_4','ano_5','residencia']::public.course_year[]),
    ('Ginecologia e Obstetrícia','gineco-obstetricia', ARRAY['ano_4','ano_5','ano_6','residencia']::public.course_year[]),
    ('Ortopedia e Traumatologia','ortopedia', ARRAY['ano_4','ano_5','residencia']::public.course_year[]),
    ('Dermatologia','dermatologia', ARRAY['ano_5','residencia']::public.course_year[]),
    ('Oftalmologia','oftalmologia', ARRAY['ano_5','residencia']::public.course_year[]),
    ('Otorrinolaringologia','otorrino', ARRAY['ano_5','residencia']::public.course_year[]),
    ('Psicologia','psicologia', ARRAY['ano_1','ano_2']::public.course_year[]),
    ('Bioética e Ética Médica','bioetica', ARRAY['ano_1','ano_5','ano_6']::public.course_year[])
)
INSERT INTO public.disciplines (name, slug)
SELECT name, slug FROM d
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.discipline_years (discipline_id, course_year)
SELECT disc.id, y::public.course_year
FROM (
  VALUES
    ('bioquimica', ARRAY['ano_1','ano_2']),
    ('anatomia', ARRAY['ano_1','ano_2']),
    ('fisiologia', ARRAY['ano_1','ano_2']),
    ('histologia', ARRAY['ano_1','ano_2']),
    ('biologia-celular', ARRAY['ano_1']),
    ('embriologia', ARRAY['ano_1','ano_2']),
    ('microbiologia', ARRAY['ano_2','ano_3']),
    ('imunologia', ARRAY['ano_2','ano_3']),
    ('patologia', ARRAY['ano_2','ano_3']),
    ('farmacologia', ARRAY['ano_2','ano_3']),
    ('epidemiologia', ARRAY['ano_2','ano_3','ano_4']),
    ('pediatria', ARRAY['ano_4','ano_5','ano_6','residencia']),
    ('clinica-medica', ARRAY['ano_3','ano_4','ano_5','ano_6','residencia']),
    ('cirurgia', ARRAY['ano_4','ano_5','ano_6','residencia']),
    ('psiquiatria', ARRAY['ano_4','ano_5','residencia']),
    ('gineco-obstetricia', ARRAY['ano_4','ano_5','ano_6','residencia']),
    ('ortopedia', ARRAY['ano_4','ano_5','residencia']),
    ('dermatologia', ARRAY['ano_5','residencia']),
    ('oftalmologia', ARRAY['ano_5','residencia']),
    ('otorrino', ARRAY['ano_5','residencia']),
    ('psicologia', ARRAY['ano_1','ano_2']),
    ('bioetica', ARRAY['ano_1','ano_5','ano_6'])
) AS s(slug, years)
JOIN public.disciplines disc ON disc.slug = s.slug
CROSS JOIN LATERAL unnest(s.years) AS y
ON CONFLICT DO NOTHING;
