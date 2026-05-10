-- Drop all existing policies on monthly_budgets to start fresh
DROP POLICY IF EXISTS "Users can view their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can insert their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can update their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can delete their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can view their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can insert their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can update their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can delete their own profile budgets" ON public.monthly_budgets;

-- Create new, simplified policies that directly check the user's profile
CREATE POLICY "Enable read access for own profile budgets"
ON public.monthly_budgets
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable insert access for own profile budgets"
ON public.monthly_budgets
FOR INSERT
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable update access for own profile budgets"
ON public.monthly_budgets
FOR UPDATE
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

CREATE POLICY "Enable delete access for own profile budgets"
ON public.monthly_budgets
FOR DELETE
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);