
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_ranking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_hub boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.search_public_users(_q text DEFAULT ''::text, _limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, full_name text, username text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.username, p.avatar_url
  FROM public.profiles p
  WHERE (_q = '' OR p.full_name ILIKE '%'||_q||'%' OR p.username ILIKE '%'||_q||'%')
    AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(p.show_in_hub, true) = true
  ORDER BY p.full_name NULLS LAST
  LIMIT LEAST(_limit, 100)
$function$;

CREATE OR REPLACE FUNCTION public.get_ranking(_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, full_name text, total bigint, correct bigint, points bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, 'Usuário') AS full_name,
    COALESCE(s.total, 0) AS total,
    COALESCE(s.correct, 0) AS correct,
    COALESCE(s.points, 0) AS points
  FROM public.profiles p
  LEFT JOIN (
    SELECT
      qa.user_id,
      count(*) AS total,
      count(*) FILTER (WHERE qa.is_correct) AS correct,
      sum(CASE WHEN qa.is_correct THEN
        CASE q.difficulty WHEN 'hard' THEN 3 WHEN 'easy' THEN 1 ELSE 2 END
      ELSE 0 END) AS points
    FROM public.question_attempts qa
    LEFT JOIN public.questions q ON q.id = qa.question_id
    GROUP BY qa.user_id
  ) s ON s.user_id = p.id
  WHERE COALESCE(p.show_in_ranking, true) = true
  ORDER BY COALESCE(s.points,0) DESC, COALESCE(s.correct,0) DESC, COALESCE(s.total,0) DESC, p.created_at ASC
  LIMIT LEAST(_limit, 500)
$function$;
