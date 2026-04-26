-- Origem da entrada no caderno
CREATE TYPE public.review_source AS ENUM ('wrong_answer', 'manual_mark', 'simulado_wrong');

CREATE TABLE public.review_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  ease NUMERIC NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_grade SMALLINT,
  last_reviewed_at TIMESTAMPTZ,
  source public.review_source NOT NULL DEFAULT 'wrong_answer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX idx_review_cards_user_due ON public.review_cards(user_id, due_at);
CREATE INDEX idx_review_cards_user ON public.review_cards(user_id);

ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_cards owner all"
  ON public.review_cards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_cards admin read"
  ON public.review_cards FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_review_cards
  BEFORE UPDATE ON public.review_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();