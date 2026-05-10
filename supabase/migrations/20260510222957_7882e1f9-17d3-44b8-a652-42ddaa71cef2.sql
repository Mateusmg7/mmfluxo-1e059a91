-- Create monthly_budgets table
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month_date DATE NOT NULL, -- Format: YYYY-MM-01
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, month_date)
);

-- Enable RLS
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile budgets"
ON public.monthly_budgets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = monthly_budgets.profile_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own profile budgets"
ON public.monthly_budgets FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = monthly_budgets.profile_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own profile budgets"
ON public.monthly_budgets FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = monthly_budgets.profile_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own profile budgets"
ON public.monthly_budgets FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = monthly_budgets.profile_id
        AND p.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_monthly_budgets_updated_at
    BEFORE UPDATE ON public.monthly_budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
