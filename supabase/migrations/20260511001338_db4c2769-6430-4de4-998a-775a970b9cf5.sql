DROP POLICY IF EXISTS "Users can manage their own monthly budgets" ON public.monthly_budgets;

CREATE POLICY "monthly_budgets_access_policy"
ON public.monthly_budgets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.financial_profiles
    WHERE financial_profiles.id = monthly_budgets.profile_id
    AND financial_profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.financial_profiles
    WHERE financial_profiles.id = monthly_budgets.profile_id
    AND financial_profiles.user_id = auth.uid()
  )
);