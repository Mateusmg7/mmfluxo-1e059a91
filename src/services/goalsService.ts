import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type GoalInsert = TablesInsert<'goals'>;
export type GoalUpdate = TablesUpdate<'goals'>;

/**
 * Busca metas do perfil ativo, já trazendo o nome da categoria associada.
 */
export async function fetchGoals(profileId: string | null | undefined) {
  let q = supabase.from('goals').select('*, categories(nome)');
  if (profileId) q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createGoal(payload: GoalInsert) {
  const { error } = await supabase.from('goals').insert(payload);
  if (error) throw error;
}

export async function updateGoal(id: string, payload: GoalUpdate) {
  const { error } = await supabase.from('goals').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}
