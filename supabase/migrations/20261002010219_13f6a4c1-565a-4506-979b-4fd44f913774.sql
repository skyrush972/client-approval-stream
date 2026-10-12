ALTER TABLE public.comments
ADD COLUMN resolved_at timestamp with time zone;

COMMENT ON COLUMN public.comments.resolved_at IS 'Date à laquelle le retour client a été marqué comme traité par l administrateur.';