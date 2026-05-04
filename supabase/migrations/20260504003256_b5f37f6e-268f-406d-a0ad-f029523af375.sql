
-- 1) Profiles: novos campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS dm_privacy text NOT NULL DEFAULT 'all' CHECK (dm_privacy IN ('all','friends'));

-- 2) Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships parties read" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "friendships requester insert" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships parties update" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships parties delete" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_touch BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Direct Messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON public.direct_messages(recipient_id, created_at DESC);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm parties read" ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "dm sender insert" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm recipient update read" ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Trigger: respeita dm_privacy do destinat\u00e1rio
CREATE OR REPLACE FUNCTION public.enforce_dm_privacy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_priv text;
  v_friend boolean;
BEGIN
  SELECT dm_privacy INTO v_priv FROM public.profiles WHERE id = NEW.recipient_id;
  IF v_priv IS NULL THEN v_priv := 'all'; END IF;
  IF v_priv = 'friends' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = NEW.sender_id AND addressee_id = NEW.recipient_id)
          OR (requester_id = NEW.recipient_id AND addressee_id = NEW.sender_id))
    ) INTO v_friend;
    IF NOT v_friend THEN
      RAISE EXCEPTION 'Este usu\xC3\xA1rio s\xC3\xB3 aceita mensagens de amigos';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER dm_enforce_privacy BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_privacy();

-- 4) Badges catalog
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Award',
  color text NOT NULL DEFAULT 'electric',
  category text NOT NULL DEFAULT 'manual' CHECK (category IN ('auto','manual')),
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges read all" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "badges admin manage" ON public.badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5) user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid,
  UNIQUE (user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges read all" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_badges admin manage" ON public.user_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed default badges
INSERT INTO public.badges (slug, name, description, icon, color, category, criteria) VALUES
  ('starter', 'Iniciante', 'Respondeu sua primeira quest\xC3\xA3o', 'Sparkles', 'electric', 'auto', '{"min_attempts":1}'),
  ('dedicated', 'Estudante Dedicado', 'Respondeu 50 quest\xC3\xB5es', 'BookOpen', 'primary', 'auto', '{"min_attempts":50}'),
  ('master', 'Mestre das Quest\xC3\xB5es', 'Respondeu 500 quest\xC3\xB5es', 'Crown', 'amber', 'auto', '{"min_attempts":500}'),
  ('top_performer', 'Top Performer', 'Mais de 80% de acerto em 100+ quest\xC3\xB5es', 'Trophy', 'amber', 'auto', '{"min_attempts":100,"min_accuracy":0.8}'),
  ('beta_tester', 'Beta Tester', 'Participou da fase beta da plataforma', 'FlaskConical', 'electric', 'manual', '{}'),
  ('professor', 'Professor', 'Educador verificado', 'GraduationCap', 'primary', 'manual', '{}'),
  ('admin_badge', 'Admin', 'Equipe HealthQuest', 'Shield', 'destructive', 'manual', '{}')
ON CONFLICT (slug) DO NOTHING;

-- 6) Fun\xC3\xA7\xC3\xA3o para recomputar badges autom\xC3\xA1ticas do usu\xC3\xA1rio atual
CREATE OR REPLACE FUNCTION public.recompute_user_badges(_user_id uuid DEFAULT auth.uid())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_correct int;
  v_acc numeric;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT count(*), count(*) FILTER (WHERE is_correct) INTO v_total, v_correct
    FROM public.question_attempts WHERE user_id = _user_id;
  v_acc := CASE WHEN v_total > 0 THEN v_correct::numeric / v_total ELSE 0 END;

  IF v_total >= 1 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
      SELECT _user_id, id FROM public.badges WHERE slug = 'starter'
    ON CONFLICT DO NOTHING;
  END IF;
  IF v_total >= 50 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
      SELECT _user_id, id FROM public.badges WHERE slug = 'dedicated'
    ON CONFLICT DO NOTHING;
  END IF;
  IF v_total >= 500 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
      SELECT _user_id, id FROM public.badges WHERE slug = 'master'
    ON CONFLICT DO NOTHING;
  END IF;
  IF v_total >= 100 AND v_acc >= 0.8 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
      SELECT _user_id, id FROM public.badges WHERE slug = 'top_performer'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 7) Funcoes seguras p/ leitura publica de perfis (nao expoe CRM)
CREATE OR REPLACE FUNCTION public.search_public_users(_q text DEFAULT '', _limit int DEFAULT 50)
RETURNS TABLE (id uuid, full_name text, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url
  FROM public.profiles p
  WHERE (_q = '' OR p.full_name ILIKE '%'||_q||'%' OR p.username ILIKE '%'||_q||'%')
    AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY p.full_name NULLS LAST
  LIMIT LEAST(_limit, 100)
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE (id uuid, full_name text, username text, avatar_url text, bio text, dm_privacy text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url, p.bio, p.dm_privacy
  FROM public.profiles p WHERE p.id = _user_id
$$;

-- 8) Realtime
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
