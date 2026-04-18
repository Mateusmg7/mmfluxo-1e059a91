import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { qk } from '@/lib/queryKeys';
import {
  createRecurringExpense,
  deleteRecurringExpense,
  fetchRecurringExpenses,
  updateRecurringExpense,
  type RecurringExpenseInsert,
  type RecurringExpenseUpdate,
} from '@/services/recurringExpensesService';

/**
 * Hook centralizado para gerenciar regras de despesas recorrentes.
 * Invalida automaticamente o cache de transações quando algo muda
 * (caso a edge function tenha gerado/removido despesas recentemente).
 */
export function useRecurringExpenses() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: qk.recurringExpenses.byProfile(activeProfile?.id),
    queryFn: () => fetchRecurringExpenses(activeProfile?.id),
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.recurringExpenses.all });
  };

  const addRule = useMutation({
    mutationFn: (payload: Omit<RecurringExpenseInsert, 'user_id' | 'profile_id'>) =>
      createRecurringExpense({
        ...payload,
        user_id: user!.id,
        profile_id: activeProfile?.id ?? null,
      }),
    onSuccess: invalidate,
  });

  const updateRule = useMutation({
    mutationFn: ({ id, ...patch }: RecurringExpenseUpdate & { id: string }) =>
      updateRecurringExpense(id, patch),
    onSuccess: invalidate,
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => deleteRecurringExpense(id),
    onSuccess: invalidate,
  });

  return { rules, isLoading, addRule, updateRule, deleteRule };
}
