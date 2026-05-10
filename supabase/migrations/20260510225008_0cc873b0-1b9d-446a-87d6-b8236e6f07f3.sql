-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can insert their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can update their own profile budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can delete their own profile budgets" ON public.monthly_budgets;

-- Enable RLS (just in case)
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Recreate policies with explicit checks
CREATE POLICY "Users can view their own profile budgets" 
ON public.monthly_budgets 
FOR SELECT 
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own profile budgets" 
ON public.monthly_budgets 
FOR INSERT 
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own profile budgets" 
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

CREATE POLICY "Users can delete their own profile budgets" 
ON public.monthly_budgets 
FOR DELETE 
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);