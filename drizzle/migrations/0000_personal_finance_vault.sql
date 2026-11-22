CREATE TABLE public.finance_vaults (user_id uuid PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_vaults TO authenticated;
GRANT ALL ON public.finance_vaults TO service_role;
ALTER TABLE public.finance_vaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads vault" ON public.finance_vaults FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner creates vault" ON public.finance_vaults FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner updates vault" ON public.finance_vaults FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner deletes vault" ON public.finance_vaults FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);