import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type TransactionInsert = TablesInsert<'transactions'>;
export type TransactionUpdate = TablesUpdate<'transactions'>;

/**
 * Busca transações de um perfil dentro de um intervalo de datas (inclusive),
 * com a categoria associada (nome e cor) e ordenadas por data/hora desc.
 */
export async function fetchTransactionsByPeriod(params: {
  profileId: string | null | undefined;
  startDate: string;
  endDate: string;
  withHourOrder?: boolean;
}) {
  const { profileId, startDate, endDate, withHourOrder = false } = params;
  let q = supabase
    .from('transactions')
    .select('*, categories(nome, cor_hex)')
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (withHourOrder) q = q.order('hora', { ascending: false });
  if (profileId) q = q.eq('profile_id', profileId);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca transações de TODOS os perfis do usuário (visão consolidada/comparativa).
 */
export async function fetchAllTransactionsByPeriod(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(nome, cor_hex)')
    .gte('data', startDate)
    .lte('data', endDate);
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca apenas valores brutos de transações para cálculos rápidos (sem join).
 */
export async function fetchTransactionValuesByPeriod(params: {
  profileId: string | null | undefined;
  startDate: string;
  endDate: string;
}) {
  const { profileId, startDate, endDate } = params;
  let q = supabase.from('transactions').select('*').gte('data', startDate).lte('data', endDate);
  if (profileId) q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(payload: TransactionInsert) {
  const { error } = await supabase.from('transactions').insert(payload);
  if (error) throw error;
}

export async function createTransactionsBatch(payloads: TransactionInsert[]) {
  const { error } = await supabase.from('transactions').insert(payloads);
  if (error) throw error;
}

export async function updateTransaction(id: string, payload: TransactionUpdate) {
  const { error } = await supabase.from('transactions').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}
