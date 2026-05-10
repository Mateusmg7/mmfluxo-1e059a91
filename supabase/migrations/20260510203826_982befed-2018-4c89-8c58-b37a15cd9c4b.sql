-- Adiciona coluna recorrente à tabela bill_reminders
ALTER TABLE public.bill_reminders ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT TRUE;

-- Comentário para documentação
COMMENT ON COLUMN public.bill_reminders.recorrente IS 'Se TRUE, o alerta se repete todo mês. Se FALSE, o alerta é desativado após o vencimento.';