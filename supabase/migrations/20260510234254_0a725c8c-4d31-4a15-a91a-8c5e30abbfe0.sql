-- Drop previous policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Enable insert access for own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Enable update access for own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Enable delete access for own profile budgets" ON public.monthly_budgets;

-- Create robust policies for monthly_budgets
-- Note: profile_id in this table refers to financial_profiles.id based on the application logic

CREATE POLICY "Users can manage their own monthly budgets"
ON public.monthly_budgets
FOR ALL
USING (
  profile_id IN (
    SELECT id FROM public.financial_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.financial_profiles WHERE user_id = auth.uid()
  )
);

-- Also add a fallback for the profiles table just in case some parts of the app use it
CREATE POLICY "Users can manage their own monthly budgets via profiles"
ON public.monthly_budgets
FOR ALL
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);