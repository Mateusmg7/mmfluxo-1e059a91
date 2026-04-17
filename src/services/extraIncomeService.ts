import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type ExtraIncomeInsert = TablesInsert<'extra_income'>;
export type ExtraIncomeUpdate = TablesUpdate<'extra_income'>;

/**
 * Busca renda extra de um perfil dentro de um intervalo de datas.
 */
export async function fetchExtraIncomeByPeriod(params: {
  profileId: string | null | undefined;
  startDate: string;
  endDate: string;
  withHourOrder?: boolean;
}) {
  const { profileId, startDate, endDate, withHourOrder = false } = params;
  let q = supabase
    .from('extra_income')
    .select('*')
    .gte('data', startDate)
    .lte('data', endDate);

  if (withHourOrder) {
    q = q.order('data', { ascending: false }).order('hora', { ascending: false });
  }
  if (profileId) q = q.eq('profile_id', profileId);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca renda extra de TODOS os perfis (visão consolidada/comparativa).
 */
export async function fetchAllExtraIncomeByPeriod(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('extra_income')
    .select('*')
    .gte('data', startDate)
    .lte('data', endDate);
  if (error) throw error;
  return data ?? [];
}

export async function createExtraIncome(payload: ExtraIncomeInsert) {
  const { error } = await supabase.from('extra_income').insert(payload);
  if (error) throw error;
}

export async function updateExtraIncome(id: string, payload: ExtraIncomeUpdate) {
  const { error } = await supabase.from('extra_income').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteExtraIncome(id: string) {
  const { error } = await supabase.from('extra_income').delete().eq('id', id);
  if (error) throw error;
}
