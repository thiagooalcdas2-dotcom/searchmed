
-- Tabela de sessões ativas por usuário
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, last_seen_at DESC);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler todas as sessões; usuário pode ler as próprias
CREATE POLICY "user_sessions admin read all" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_sessions self read" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins gerenciam tudo
CREATE POLICY "user_sessions admin manage" ON public.user_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela de bloqueio de contas (admin)
CREATE TABLE public.account_blocks (
  user_id uuid PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid,
  reason text
);

ALTER TABLE public.account_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_blocks admin manage" ON public.account_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "account_blocks self read" ON public.account_blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
