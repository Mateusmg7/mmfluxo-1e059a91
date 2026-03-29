-- Fix old plural values to singular
UPDATE public.transactions SET tipo_despesa = 'essencial' WHERE tipo_despesa = 'essenciais';
UPDATE public.transactions SET tipo_despesa = 'imprevisto' WHERE tipo_despesa = 'imprevistos';
UPDATE public.transactions SET tipo_despesa = 'besteira' WHERE tipo_despesa = 'besteiras';