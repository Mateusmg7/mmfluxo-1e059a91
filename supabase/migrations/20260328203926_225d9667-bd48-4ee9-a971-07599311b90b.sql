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
    (NEW.id, 'Moradia',     '#3B82F6', 'essenciais',  true, default_profile_id),
    (NEW.id, 'Mercado',     '#F59E0B', 'essenciais',  true, default_profile_id),
    (NEW.id, 'Transporte',  '#8B5CF6', 'essenciais',  true, default_profile_id),
    (NEW.id, 'Contas',      '#EC4899', 'essenciais',  true, default_profile_id),
    (NEW.id, 'Saúde',       '#10B981', 'essenciais',  true, default_profile_id),
    (NEW.id, 'Lazer',       '#F97316', 'lazer',       true, default_profile_id),
    (NEW.id, 'Imprevistos', '#EF4444', 'imprevistos', true, default_profile_id),
    (NEW.id, 'Besteiras',   '#A855F7', 'besteiras',   true, default_profile_id);

  RETURN NEW;
END;
$function$;