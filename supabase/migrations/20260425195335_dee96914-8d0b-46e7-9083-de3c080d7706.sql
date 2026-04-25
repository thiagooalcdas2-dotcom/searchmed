
CREATE POLICY "profiles admin read all" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attempts admin read all" ON public.question_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "simulados admin read all" ON public.simulados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "marks admin read all" ON public.question_marks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
