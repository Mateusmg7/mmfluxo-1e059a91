import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth } from 'date-fns';

export interface MonthlyBudget {
  id: string;
  profile_id: string;
  month_date: string;
  amount: number;
}

export const fetchMonthlyBudget = async (profileId: string | undefined, date: Date): Promise<MonthlyBudget | null> => {
  if (!profileId) return null;

  const monthDate = format(startOfMonth(date), 'yyyy-MM-01');

  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('profile_id', profileId)
    .eq('month_date', monthDate)
    .maybeSingle();

  if (error) {
    console.error('Error fetching monthly budget:', error);
    return null;
  }

  return data;
};

export const upsertMonthlyBudget = async (profileId: string, date: Date, amount: number): Promise<MonthlyBudget | null> => {
  const monthDate = format(startOfMonth(date), 'yyyy-MM-01');

  const { data, error } = await supabase
    .from('monthly_budgets')
    .upsert(
      { profile_id: profileId, month_date: monthDate, amount },
      { onConflict: 'profile_id,month_date' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting monthly budget:', error);
    throw error;
  }

  return data;
};
