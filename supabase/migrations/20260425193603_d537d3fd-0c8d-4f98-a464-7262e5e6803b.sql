
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','professor','student');
CREATE TYPE public.question_type AS ENUM ('multiple_choice','clinical_case','true_false');
CREATE TYPE public.difficulty AS ENUM ('easy','medium','hard');
CREATE TYPE public.question_origin AS ENUM ('internal','enamed','residencia_itajuba','residencia_alfenas','residencia_pouso_alegre','residencia_lavras','residencia_sp_usp','residencia_sp_santa_casa','residencia_sp_outros');
CREATE TYPE public.review_status AS ENUM ('approved','pending_review','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  crm TEXT,
  course_period TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- QUESTIONS
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement TEXT NOT NULL,
  type public.question_type NOT NULL DEFAULT 'multiple_choice',
  alternatives JSONB NOT NULL, -- [{key:'A',text:'...'},...]
  correct_alternative TEXT NOT NULL,
  explanation TEXT NOT NULL,
  discipline TEXT NOT NULL,
  subtopic TEXT,
  difficulty public.difficulty NOT NULL DEFAULT 'medium',
  origin public.question_origin NOT NULL DEFAULT 'internal',
  reference_year INT,
  tags TEXT[] DEFAULT '{}',
  review_status public.review_status NOT NULL DEFAULT 'approved',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_confidence NUMERIC(3,2),
  reviewer_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_questions_origin ON public.questions(origin);
CREATE INDEX idx_questions_discipline ON public.questions(discipline);
CREATE INDEX idx_questions_status ON public.questions(review_status);

CREATE POLICY "questions read approved" ON public.questions FOR SELECT TO authenticated
  USING (review_status = 'approved' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));
CREATE POLICY "questions admin/prof manage" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

-- SIMULADOS
CREATE TABLE public.simulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  question_ids UUID[] NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  total_questions INT NOT NULL,
  correct_count INT
);
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulados owner all" ON public.simulados FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ATTEMPTS (per question per user)
CREATE TABLE public.question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  simulado_id UUID REFERENCES public.simulados(id) ON DELETE SET NULL,
  selected_alternative TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attempts owner all" ON public.question_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_attempts_user ON public.question_attempts(user_id);

-- FAVORITES / REVIEW LATER
CREATE TABLE public.question_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  mark TEXT NOT NULL CHECK (mark IN ('favorite','review_later','difficult')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id, mark)
);
ALTER TABLE public.question_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marks owner all" ON public.question_marks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
