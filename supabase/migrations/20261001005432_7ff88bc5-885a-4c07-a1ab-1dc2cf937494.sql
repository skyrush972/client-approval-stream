REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.current_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_email() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_download_url(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_download_url(UUID) TO authenticated;