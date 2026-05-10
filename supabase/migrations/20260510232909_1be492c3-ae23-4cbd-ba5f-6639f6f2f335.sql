-- Primeiro, remover as políticas existentes que possam estar conflitando
DROP POLICY IF EXISTS "Users can insert their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can update their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can view their own monthly budgets" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Users can delete their own monthly budgets" ON public.monthly_budgets;

-- Habilitar RLS (caso não esteja)
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Política de Visualização
CREATE POLICY "Users can view their own monthly budgets"
ON public.monthly_budgets
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.financial_profiles 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Política de Inserção
CREATE POLICY "Users can insert their own monthly budgets"
ON public.monthly_budgets
FOR INSERT
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.financial_profiles 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Política de Atualização
CREATE POLICY "Users can update their own monthly budgets"
ON public.monthly_budgets
FOR UPDATE
USING (
  profile_id IN (
    SELECT id FROM public.financial_profiles 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.financial_profiles 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Política de Deleção
CREATE POLICY "Users can delete their own monthly budgets"
ON public.monthly_budgets
FOR DELETE
USING (
  profile_id IN (
    SELECT id FROM public.financial_profiles 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);