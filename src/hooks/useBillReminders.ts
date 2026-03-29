import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

export interface BillReminder {
  id: string;
  user_id: string;
  profile_id: string | null;
  nome: string;
  valor: number | null;
  dia_vencimento: number;
  ativo: boolean;
  created_at: string;
}

export function useBillReminders() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['bill_reminders', user?.id, activeProfile?.id],
    queryFn: async () => {
      let query = supabase
        .from('bill_reminders')
        .select('*')
        .eq('user_id', user!.id)
        .order('dia_vencimento', { ascending: true });

      if (activeProfile?.id) {
        query = query.eq('profile_id', activeProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BillReminder[];
    },
    enabled: !!user,
  });

  const addReminder = useMutation({
    mutationFn: async (reminder: { nome: string; valor: number | null; dia_vencimento: number }) => {
      const { error } = await supabase.from('bill_reminders').insert({
        user_id: user!.id,
        profile_id: activeProfile?.id || null,
        ...reminder,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bill_reminders'] }),
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BillReminder> & { id: string }) => {
      const { error } = await supabase.from('bill_reminders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bill_reminders'] }),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bill_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bill_reminders'] }),
  });

  // Get reminders that are due today or tomorrow
  const today = new Date();
  const todayDay = today.getDate();
  const tomorrowDay = new Date(today.getTime() + 86400000).getDate();

  const urgentReminders = reminders.filter(
    (r) => r.ativo && (r.dia_vencimento === todayDay || r.dia_vencimento === tomorrowDay)
  );

  return { reminders, isLoading, addReminder, updateReminder, deleteReminder, urgentReminders };
}
