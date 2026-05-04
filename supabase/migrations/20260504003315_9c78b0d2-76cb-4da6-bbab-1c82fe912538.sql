
REVOKE EXECUTE ON FUNCTION public.search_public_users(text, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recompute_user_badges(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_dm_privacy() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_users(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_user_badges(uuid) TO authenticated;
