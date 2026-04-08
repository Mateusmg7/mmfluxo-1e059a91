
ALTER TABLE public.transactions
  ADD COLUMN parcela_atual integer DEFAULT NULL,
  ADD COLUMN total_parcelas integer DEFAULT NULL,
  ADD COLUMN parcela_grupo_id uuid DEFAULT NULL;

CREATE INDEX idx_transactions_parcela_grupo ON public.transactions(parcela_grupo_id);
