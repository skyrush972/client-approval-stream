ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON public.projects (archived_at);

DROP POLICY IF EXISTS projects_client_select ON public.projects;
CREATE POLICY projects_client_select ON public.projects
  FOR SELECT TO authenticated
  USING (archived_at IS NULL AND lower(client_email) = public.current_email());

DROP POLICY IF EXISTS videos_client_select ON public.videos;
CREATE POLICY videos_client_select ON public.videos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = videos.project_id
        AND p.archived_at IS NULL
        AND lower(p.client_email) = public.current_email()
    )
  );

DROP POLICY IF EXISTS comments_client_select ON public.comments;
CREATE POLICY comments_client_select ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = comments.project_id
        AND p.archived_at IS NULL
        AND lower(p.client_email) = public.current_email()
    )
  );

CREATE OR REPLACE FUNCTION public.get_download_url(_video_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT;
BEGIN
  SELECT v.download_url INTO v_url
  FROM public.videos v
  JOIN public.projects p ON p.id = v.project_id
  WHERE v.id = _video_id
    AND p.archived_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (p.is_paid AND lower(p.client_email) = public.current_email())
    );
  RETURN v_url;
END;
$function$;