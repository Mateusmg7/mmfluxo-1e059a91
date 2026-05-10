-- First, let's drop any potential conflicting policies that might still exist with different names
DO $$ 
BEGIN
    -- Drop policies if they exist (using common names from history)
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all access for own profile budgets' AND tablename = 'monthly_budgets') THEN
        DROP POLICY "Enable all access for own profile budgets" ON monthly_budgets;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for own profile budgets' AND tablename = 'monthly_budgets') THEN
        DROP POLICY "Enable insert access for own profile budgets" ON monthly_budgets;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for own profile budgets' AND tablename = 'monthly_budgets') THEN
        DROP POLICY "Enable update access for own profile budgets" ON monthly_budgets;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable select access for own profile budgets' AND tablename = 'monthly_budgets') THEN
        DROP POLICY "Enable select access for own profile budgets" ON monthly_budgets;
    END IF;
END $$;

-- Drop the current one to recreate it cleanly
DROP POLICY IF EXISTS "Users can manage their own monthly budgets" ON public.monthly_budgets;

-- Enable RLS
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Create a clean, single policy for all operations
-- IMPORTANT: We use financial_profiles because monthly_budgets.profile_id is a FK to financial_profiles(id)
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
