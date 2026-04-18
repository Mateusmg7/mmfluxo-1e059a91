import { supabase } from '@/integrations/supabase/client';

// 🔄 Despesas recorrentes (regras que se repetem todo mês)
// Centraliza todas as queries da tabela recurring_expenses para que as páginas
// nunca chamem supabase.from('recurring_expenses') diretamente.

export interface RecurringExpense {
  id: string;
  user_id: string;
  profile_id: string | null;
  category_id: string | null;
  nome: string;
  valor: number;
  dia_vencimento: number;
  tipo_despesa: string;
  motivo: string;
  ativo: boolean;
  ultima_geracao_ano_mes: string | null;
  created_at: string;
  updated_at: string;
}

export type RecurringExpenseInsert = Omit<
  RecurringExpense,
  'id' | 'created_at' | 'updated_at' | 'ultima_geracao_ano_mes'
>;

export type RecurringExpenseUpdate = Partial<RecurringExpenseInsert>;

/** Busca todas as regras recorrentes de um perfil. */
export async function fetchRecurringExpenses(profileId: string | null | undefined) {
  let q = (supabase as any)
    .from('recurring_expenses')
    .select('*, categories(nome, cor_hex)')
    .order('dia_vencimento', { ascending: true });
  if (profileId) q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<RecurringExpense & { categories?: { nome: string; cor_hex: string } | null }>;
}

export async function createRecurringExpense(payload: RecurringExpenseInsert) {
  const { error } = await (supabase as any).from('recurring_expenses').insert(payload);
  if (error) throw error;
}

export async function updateRecurringExpense(id: string, payload: RecurringExpenseUpdate) {
  const { error } = await (supabase as any).from('recurring_expenses').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteRecurringExpense(id: string) {
  const { error } = await (supabase as any).from('recurring_expenses').delete().eq('id', id);
  if (error) throw error;
}
