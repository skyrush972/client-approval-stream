ALTER TABLE public.projects ADD COLUMN share_token text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
CREATE UNIQUE INDEX projects_share_token_idx ON public.projects(share_token);
ALTER TABLE public.comments ALTER COLUMN author_id DROP NOT NULL;