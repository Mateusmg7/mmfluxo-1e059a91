-- Tabela de regras de despesas recorrentes
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.financial_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  tipo_despesa TEXT NOT NULL DEFAULT 'essencial',
  motivo TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_geracao_ano_mes TEXT,  -- formato 'YYYY-MM' para evitar geração duplicada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita segurança a nível de linha
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuário só mexe nas próprias regras
CREATE POLICY "Users can view own recurring expenses"
  ON public.recurring_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expenses"
  ON public.recurring_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expenses"
  ON public.recurring_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expenses"
  ON public.recurring_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para acelerar a busca diária do cron
CREATE INDEX idx_recurring_expenses_ativo ON public.recurring_expenses(ativo) WHERE ativo = true;
CREATE INDEX idx_recurring_expenses_user ON public.recurring_expenses(user_id);

-- Vínculo opcional na tabela de transações (pra rastrear de qual regra veio)
ALTER TABLE public.transactions
  ADD COLUMN recurring_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_recurring ON public.transactions(recurring_id) WHERE recurring_id IS NOT NULL;