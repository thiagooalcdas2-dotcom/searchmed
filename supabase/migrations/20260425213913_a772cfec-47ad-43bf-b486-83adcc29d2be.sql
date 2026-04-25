
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-imports', 'exam-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exam-imports admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exam-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exam-imports admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exam-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exam-imports admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exam-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exam-imports admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-imports' AND public.has_role(auth.uid(), 'admin'));
