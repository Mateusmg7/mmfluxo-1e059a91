import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useCallback, useEffect, useRef } from 'react';
import { differenceInDays, format, subDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { fireConfetti } from '@/lib/confetti';
import { playAchievementSound } from '@/lib/achievementSound';

interface Badge {
  id: string;
  code: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: string;
  criterio: any;
}

interface Achievement {
  id: string;
  badge_id: string;
  unlocked_at: string;
  metadata: any;
  badges: Badge;
}

interface Streak {
  current_streak: number;
  best_streak: number;
  last_check_date: string | null;
}

export function useGamification() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();

  const { data: badges = [] } = useQuery({
    queryKey: ['badges'],
    queryFn: async () => {
      const { data } = await supabase.from('badges').select('*');
      return (data ?? []) as Badge[];
    },
    enabled: !!user,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['user_achievements', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_achievements')
        .select('*, badges(*)')
        .eq('user_id', user!.id);
      return (data ?? []) as Achievement[];
    },
    enabled: !!user,
  });

  const { data: streak } = useQuery({
    queryKey: ['user_streaks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as Streak | null;
    },
    enabled: !!user,
  });

  const celebrateBadge = useCallback((badge: Badge) => {
    fireConfetti();
    playAchievementSound();

    // Special toast
    toast.success(`${badge.icone} ${badge.nome}`, {
      description: badge.descricao,
      duration: 5000,
      className: 'achievement-toast',
    });
  }, []);

  const unlockBadge = useMutation({
    mutationFn: async ({ badgeId, metadata }: { badgeId: string; metadata?: any }) => {
      const { error } = await supabase.from('user_achievements').insert({
        user_id: user!.id,
        badge_id: badgeId,
        metadata: metadata ?? {},
      });
      if (error && !error.message.includes('duplicate')) throw error;
      // Return the badge for celebration
      return badges.find(b => b.id === badgeId);
    },
    onSuccess: (badge) => {
      queryClient.invalidateQueries({ queryKey: ['user_achievements'] });
      if (badge) celebrateBadge(badge);
    },
  });

  const checkAndUpdateStreak = useCallback(async () => {
    if (!user || !activeProfile) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Check if there are "besteira" transactions yesterday
    const { data: wasteTransactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .eq('tipo_despesa', 'besteira')
      .eq('data', yesterday)
      .limit(1);

    const hadWaste = (wasteTransactions?.length ?? 0) > 0;

    // Get or create streak
    let currentStreak = streak;
    if (!currentStreak) {
      const { data } = await supabase
        .from('user_streaks')
        .insert({ user_id: user.id, current_streak: 0, best_streak: 0, last_check_date: null })
        .select()
        .single();
      currentStreak = data;
    }

    if (!currentStreak) return;
    if (currentStreak.last_check_date === today) return; // Already checked today

    let newStreak = currentStreak.current_streak;
    if (hadWaste) {
      newStreak = 0;
    } else {
      newStreak = currentStreak.current_streak + 1;
    }
    const newBest = Math.max(newStreak, currentStreak.best_streak);

    await supabase
      .from('user_streaks')
      .update({ current_streak: newStreak, best_streak: newBest, last_check_date: today, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    queryClient.invalidateQueries({ queryKey: ['user_streaks'] });

    return newStreak;
  }, [user, activeProfile, streak, queryClient]);

  const checkAllBadges = useCallback(async () => {
    if (!user || !activeProfile || badges.length === 0) return;

    const earnedCodes = new Set(achievements.map(a => a.badges?.code));

    // Check each badge
    for (const badge of badges) {
      if (earnedCodes.has(badge.code)) continue;

      const criterio = badge.criterio as any;
      let shouldUnlock = false;

      switch (criterio.type) {
        case 'first_goal_hit': {
          const { data: goals } = await supabase
            .from('goals')
            .select('*, categories(nome)')
            .eq('user_id', user.id)
            .eq('profile_id', activeProfile.id);
          if (goals && goals.length > 0) {
            // Check if any goal is met
            const { data: txns } = await supabase
              .from('transactions')
              .select('valor, category_id, tipo_despesa')
              .eq('user_id', user.id)
              .eq('profile_id', activeProfile.id);
            const { data: income } = await supabase
              .from('extra_income')
              .select('valor')
              .eq('user_id', user.id)
              .eq('profile_id', activeProfile.id);

            const totalDespesas = (txns ?? []).reduce((s, t) => s + Number(t.valor), 0);
            const totalRenda = (income ?? []).reduce((s, t) => s + Number(t.valor), 0);

            for (const goal of goals) {
              if (goal.tipo_meta === 'meta_renda_extra' && totalRenda >= Number(goal.valor_alvo)) {
                shouldUnlock = true;
                break;
              }
              if (goal.tipo_meta === 'limite_despesas' && totalDespesas <= Number(goal.valor_alvo)) {
                shouldUnlock = true;
                break;
              }
              if (goal.tipo_meta === 'limite_categoria') {
                const catTotal = (txns ?? []).filter(t => t.category_id === goal.category_id).reduce((s, t) => s + Number(t.valor), 0);
                if (catTotal <= Number(goal.valor_alvo)) {
                  shouldUnlock = true;
                  break;
                }
              }
            }
          }
          break;
        }

        case 'first_extra_income': {
          const { count } = await supabase
            .from('extra_income')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
          shouldUnlock = (count ?? 0) > 0;
          break;
        }

        case 'streak_no_waste': {
          const currentStreakVal = streak?.current_streak ?? 0;
          shouldUnlock = currentStreakVal >= criterio.days;
          break;
        }

        case 'days_using_app': {
          const { data: profile } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('user_id', user.id)
            .single();
          if (profile) {
            const days = differenceInDays(new Date(), parseISO(profile.created_at));
            shouldUnlock = days >= criterio.days;
          }
          break;
        }

        case 'spending_under_percent': {
          const { data: goals } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', user.id)
            .eq('profile_id', activeProfile.id)
            .eq('tipo_meta', 'limite_despesas');
          if (goals && goals.length > 0) {
            const { data: txns } = await supabase
              .from('transactions')
              .select('valor')
              .eq('user_id', user.id)
              .eq('profile_id', activeProfile.id);
            const totalDespesas = (txns ?? []).reduce((s, t) => s + Number(t.valor), 0);
            const limit = Number(goals[0].valor_alvo);
            if (limit > 0 && totalDespesas > 0) {
              shouldUnlock = (totalDespesas / limit) * 100 <= criterio.percent;
            }
          }
          break;
        }

        case 'goals_in_categories': {
          const { data: goals } = await supabase
            .from('goals')
            .select('category_id')
            .eq('user_id', user.id)
            .eq('tipo_meta', 'limite_categoria')
            .not('category_id', 'is', null);
          const uniqueCats = new Set((goals ?? []).map(g => g.category_id));
          shouldUnlock = uniqueCats.size >= criterio.min;
          break;
        }

        case 'goals_hit_count': {
          // Count achieved goals (simplified: count user_achievements with tipo meta_batida)
          const metaBadges = achievements.filter(a => a.badges?.tipo === 'meta_batida');
          shouldUnlock = metaBadges.length >= criterio.count;
          break;
        }
      }

      if (shouldUnlock) {
        unlockBadge.mutate({ badgeId: badge.id });
      }
    }
  }, [user, activeProfile, badges, achievements, streak, unlockBadge]);

  // Auto-check on mount
  useEffect(() => {
    if (user && activeProfile && badges.length > 0) {
      checkAndUpdateStreak().then(() => checkAllBadges());
    }
  }, [user?.id, activeProfile?.id, badges.length]);

  const unlockedBadges = achievements.map(a => ({
    ...a.badges,
    unlocked_at: a.unlocked_at,
  }));

  const lockedBadges = badges.filter(b => !achievements.some(a => a.badge_id === b.id));

  const level = Math.floor(achievements.length / 3) + 1;
  const xpProgress = (achievements.length % 3) / 3 * 100;

  return {
    badges,
    unlockedBadges,
    lockedBadges,
    achievements,
    streak: streak ?? { current_streak: 0, best_streak: 0 },
    level,
    xpProgress,
    checkAllBadges,
    checkAndUpdateStreak,
  };
}
