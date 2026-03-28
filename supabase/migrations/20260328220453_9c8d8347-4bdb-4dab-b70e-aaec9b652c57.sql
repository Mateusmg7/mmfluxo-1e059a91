
-- 1. Add tipo_despesa and motivo to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tipo_despesa text NOT NULL DEFAULT 'essencial';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS motivo text NOT NULL DEFAULT '';

-- 2. Make category_id nullable
ALTER TABLE public.transactions ALTER COLUMN category_id DROP NOT NULL;

-- 3. Backfill tipo_despesa from existing categories.grupo
UPDATE public.transactions t
SET tipo_despesa = c.grupo
FROM public.categories c
WHERE t.category_id = c.id;

-- 4. For non-essential transactions, clear category_id
UPDATE public.transactions
SET category_id = NULL
WHERE tipo_despesa != 'essencial';

-- 5. Delete non-essential default categories (lazer, imprevistos, besteiras)
-- First remove any transactions referencing them (already cleared above)
DELETE FROM public.categories WHERE grupo != 'essenciais' AND is_default = true;

-- 6. Update handle_new_user to only create essential categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_profile_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);

  INSERT INTO public.financial_profiles (user_id, name, icon, color, is_default)
  VALUES (NEW.id, 'Pessoal', '👤', '#0C5BA8', true)
  RETURNING id INTO default_profile_id;

  INSERT INTO public.categories (user_id, nome, cor_hex, grupo, is_default, profile_id) VALUES
    (NEW.id, 'Moradia',     '#3B82F6', 'essenciais', true, default_profile_id),
    (NEW.id, 'Mercado',     '#F59E0B', 'essenciais', true, default_profile_id),
    (NEW.id, 'Transporte',  '#8B5CF6', 'essenciais', true, default_profile_id),
    (NEW.id, 'Contas',      '#EC4899', 'essenciais', true, default_profile_id),
    (NEW.id, 'Saúde',       '#10B981', 'essenciais', true, default_profile_id),
    (NEW.id, 'Educação',    '#06B6D4', 'essenciais', true, default_profile_id);

  RETURN NEW;
END;
$function$;
