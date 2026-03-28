
-- Create financial_profiles table
CREATE TABLE public.financial_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pessoal',
  icon TEXT NOT NULL DEFAULT '👤',
  color TEXT NOT NULL DEFAULT '#0C5BA8',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own financial profiles" ON public.financial_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own financial profiles" ON public.financial_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own financial profiles" ON public.financial_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own financial profiles" ON public.financial_profiles FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- Add profile_id to existing tables (nullable initially for backward compat)
ALTER TABLE public.transactions ADD COLUMN profile_id UUID REFERENCES public.financial_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.extra_income ADD COLUMN profile_id UUID REFERENCES public.financial_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN profile_id UUID REFERENCES public.financial_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN profile_id UUID REFERENCES public.financial_profiles(id) ON DELETE CASCADE;

-- Create validation function to limit 5 profiles per user
CREATE OR REPLACE FUNCTION public.check_max_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.financial_profiles WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 profiles per user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_profiles
  BEFORE INSERT ON public.financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_max_profiles();

-- Update handle_new_user to also create a default financial profile and link categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_profile_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);

  -- Create default financial profile
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
    (NEW.id, 'Imprevistos', '#EF4444', 'imprevistos', true, default_profile_id);

  RETURN NEW;
END;
$$;

-- Backfill: create default financial profile for existing users and link existing data
DO $$
DECLARE
  r RECORD;
  fp_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.profiles LOOP
    INSERT INTO public.financial_profiles (user_id, name, icon, color, is_default)
    VALUES (r.user_id, 'Pessoal', '👤', '#0C5BA8', true)
    RETURNING id INTO fp_id;
    
    UPDATE public.transactions SET profile_id = fp_id WHERE user_id = r.user_id AND profile_id IS NULL;
    UPDATE public.extra_income SET profile_id = fp_id WHERE user_id = r.user_id AND profile_id IS NULL;
    UPDATE public.categories SET profile_id = fp_id WHERE user_id = r.user_id AND profile_id IS NULL;
    UPDATE public.goals SET profile_id = fp_id WHERE user_id = r.user_id AND profile_id IS NULL;
  END LOOP;
END;
$$;
