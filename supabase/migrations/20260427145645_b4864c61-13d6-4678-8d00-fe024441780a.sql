
-- 1. Garante role admin somente para thiagooalcdas2@gmail.com
DO $$
DECLARE admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE lower(email) = 'thiagooalcdas2@gmail.com' LIMIT 1;
  IF admin_uid IS NOT NULL THEN
    -- remove admin de qualquer outro
    DELETE FROM public.user_roles WHERE role = 'admin' AND user_id <> admin_uid;
    -- garante que ele tenha
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    -- se ainda não existe, ao menos remove qualquer admin pré-existente que não seja ele
    -- (será inserido quando ele se cadastrar via trigger + override manual)
    NULL;
  END IF;
END $$;

-- 2. Trigger que bloqueia bloqueio/encerramento de admin
CREATE OR REPLACE FUNCTION public.protect_admin_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'account_blocks' THEN
    IF public.has_role(NEW.user_id, 'admin') THEN
      RAISE EXCEPTION 'Contas de administrador não podem ser bloqueadas';
    END IF;
  ELSIF TG_TABLE_NAME = 'user_sessions' THEN
    -- impede revogar sessões de admin
    IF TG_OP = 'UPDATE'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND public.has_role(OLD.user_id, 'admin') THEN
      RAISE EXCEPTION 'Sessões de administrador não podem ser encerradas';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_admin_blocks ON public.account_blocks;
CREATE TRIGGER protect_admin_blocks
  BEFORE INSERT OR UPDATE ON public.account_blocks
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_account();

DROP TRIGGER IF EXISTS protect_admin_sessions ON public.user_sessions;
CREATE TRIGGER protect_admin_sessions
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_account();

-- 3. handle_new_user: nunca cria admin, só student
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Sempre student. Promoção a admin é manual (apenas via SQL/superadmin).
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
