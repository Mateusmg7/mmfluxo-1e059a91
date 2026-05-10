-- Drop the incorrect foreign key constraint
ALTER TABLE public.monthly_budgets 
DROP CONSTRAINT IF EXISTS monthly_budgets_profile_id_fkey;

-- Add the correct foreign key constraint pointing to financial_profiles
ALTER TABLE public.monthly_budgets
ADD CONSTRAINT monthly_budgets_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES public.financial_profiles(id) 
ON DELETE CASCADE;

-- Update RLS policies to be absolutely certain they match the financial_profiles table
DROP POLICY IF EXISTS "Users can manage their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can manage their own monthly budgets via profiles" ON public.monthly_budgets;

CREATE POLICY "Users can manage their own monthly budgets"
ON public.monthly_budgets
FOR ALL
TO authenticated
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