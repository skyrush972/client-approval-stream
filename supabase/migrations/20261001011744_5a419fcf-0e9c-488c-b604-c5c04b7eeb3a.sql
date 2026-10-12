CREATE POLICY "rushs_admin_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'rushs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'rushs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "rushs_client_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rushs' AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND lower(p.client_email) = public.current_email()
  )
);