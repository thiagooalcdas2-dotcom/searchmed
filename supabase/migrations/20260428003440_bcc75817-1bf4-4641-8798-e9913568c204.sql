CREATE TABLE IF NOT EXISTS public.admin_credentials (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_credentials admin only"
ON public.admin_credentials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER admin_credentials_touch_updated_at
BEFORE UPDATE ON public.admin_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();