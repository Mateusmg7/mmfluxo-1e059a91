import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type CategoryInsert = TablesInsert<'categories'>;
export type CategoryUpdate = TablesUpdate<'categories'>;

/**
 * Busca categorias do perfil ativo. Pode filtrar pelo grupo (ex.: 'essenciais').
 */
export async function fetchCategories(params: {
  profileId: string | null | undefined;
  grupo?: 'essenciais' | 'lazer' | 'imprevistos' | 'besteiras';
}) {
  const { profileId, grupo } = params;
  let q = supabase.from('categories').select('*').order('nome');
  if (grupo) q = q.eq('grupo', grupo);
  if (profileId) q = q.eq('profile_id', profileId);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(payload: CategoryInsert) {
  const { error } = await supabase.from('categories').insert(payload);
  if (error) throw error;
}

/**
 * Cria uma categoria e devolve apenas o id criado (usado na criação inline).
 */
export async function createCategoryReturnId(payload: CategoryInsert): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCategory(id: string, payload: CategoryUpdate) {
  const { error } = await supabase.from('categories').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}
