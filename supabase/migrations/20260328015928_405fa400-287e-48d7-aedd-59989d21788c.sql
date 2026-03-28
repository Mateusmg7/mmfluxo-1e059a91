
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  mes_referencia_inicio INT NOT NULL DEFAULT 1,
  fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Category group enum
CREATE TYPE public.category_group AS ENUM ('essenciais', 'lazer', 'imprevistos');

-- Categories table (despesas only)
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor_hex TEXT NOT NULL DEFAULT '#0C5BA8',
  grupo public.category_group NOT NULL DEFAULT 'essenciais',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Transactions table (ONLY expenses)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL DEFAULT '',
  valor DECIMAL(12,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TEXT NOT NULL DEFAULT '00:00',
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('previsto', 'pago')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Extra Income table
CREATE TABLE public.extra_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TEXT NOT NULL DEFAULT '00:00',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.extra_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extra income" ON public.extra_income FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own extra income" ON public.extra_income FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own extra income" ON public.extra_income FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own extra income" ON public.extra_income FOR DELETE USING (auth.uid() = user_id);

-- Goals table
CREATE TYPE public.goal_type AS ENUM ('limite_despesas', 'meta_renda_extra', 'limite_categoria');

CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_meta TEXT NOT NULL,
  tipo_meta public.goal_type NOT NULL,
  valor_alvo DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  periodo_tipo TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo_tipo IN ('mensal', 'personalizado')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_opcional DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);

-- Trigger to auto-create profile and default categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);

  INSERT INTO public.categories (user_id, nome, cor_hex, grupo, is_default) VALUES
    (NEW.id, 'Moradia',     '#3B82F6', 'essenciais',  true),
    (NEW.id, 'Mercado',     '#F59E0B', 'essenciais',  true),
    (NEW.id, 'Transporte',  '#8B5CF6', 'essenciais',  true),
    (NEW.id, 'Contas',      '#EC4899', 'essenciais',  true),
    (NEW.id, 'Saúde',       '#10B981', 'essenciais',  true),
    (NEW.id, 'Lazer',       '#F97316', 'lazer',       true),
    (NEW.id, 'Imprevistos', '#EF4444', 'imprevistos', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, data);
CREATE INDEX idx_extra_income_user_date ON public.extra_income(user_id, data);
CREATE INDEX idx_categories_user ON public.categories(user_id);
CREATE INDEX idx_goals_user ON public.goals(user_id);
