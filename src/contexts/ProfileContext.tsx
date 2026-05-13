import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface FinancialProfile {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  orcamento_mensal: number;
  pin?: string;
  pin_reset_code?: string;
  pin_reset_expires?: string;
}

interface ProfileContextType {
  profiles: FinancialProfile[];
  activeProfile: FinancialProfile | null;
  setActiveProfileId: (id: string) => void;
  createProfile: (name: string, icon: string, color: string, pin?: string) => Promise<void>;
  updateProfile: (id: string, name: string, icon: string, color: string, pin?: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  loading: boolean;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfileId: () => {},
  createProfile: async () => {},
  updateProfile: async () => {},
  deleteProfile: async () => {},
  loading: true,
  currentMonth: new Date(),
  setCurrentMonth: () => {},
});

export const useProfile = () => useContext(ProfileContext);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: qk.financialProfiles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return data as FinancialProfile[];
    },
    enabled: !!user,
  });

  // Set default active profile
  useEffect(() => {
    if (profiles.length > 0 && !activeProfileId) {
      const storedId = localStorage.getItem('mm_active_profile');
      const storedProfile = profiles.find(p => p.id === storedId);
      
      // Only auto-restore if profile exists and HAS NO PIN
      if (storedProfile && !storedProfile.pin) {
        setActiveProfileId(storedId);
      } else {
        // Find first profile without PIN, or default to first if none
        const defaultProfile = profiles.find(p => p.is_default && !p.pin) || profiles.find(p => !p.pin) || profiles[0];
        if (defaultProfile) {
          setActiveProfileId(defaultProfile.id);
          if (!defaultProfile.pin) {
            localStorage.setItem('mm_active_profile', defaultProfile.id);
          }
        }
      }
    }
  }, [profiles, activeProfileId]);

  const handleSetActive = (id: string) => {
    setActiveProfileId(id);
    const profile = profiles.find(p => p.id === id);
    if (profile && !profile.pin) {
      localStorage.setItem('mm_active_profile', id);
    } else {
      localStorage.setItem('mm_active_profile_hint', id);
      // If it has a PIN, we don't store it in localStorage to force re-entry on reload
      localStorage.removeItem('mm_active_profile');
    }
    // Invalidate all data queries so they refetch with new profile
    qc.invalidateQueries({ queryKey: qk.transactions.all });
    qc.invalidateQueries({ queryKey: qk.extraIncome.all });
    qc.invalidateQueries({ queryKey: qk.categories.all });
    qc.invalidateQueries({ queryKey: qk.goals.all });
  };

  const createProfile = async (name: string, icon: string, color: string, pin?: string) => {
    if (profiles.length >= 5) {
      toast.error('Máximo de 5 perfis atingido');
      return;
    }
    const { data, error } = await supabase.from('financial_profiles').insert({
      user_id: user!.id, name, icon, color, pin,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // Default categories are created by the database trigger (handle_new_user) for the
    // first profile only. For additional profiles, create the same essential set here
    // to keep behavior consistent.
    const defaultCats = [
      { nome: 'Moradia',    cor_hex: '#3B82F6', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Mercado',    cor_hex: '#F59E0B', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Transporte', cor_hex: '#8B5CF6', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Contas',     cor_hex: '#EC4899', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Saúde',      cor_hex: '#10B981', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Educação',   cor_hex: '#06B6D4', grupo: 'essenciais' as const, is_default: true },
    ];
    await supabase.from('categories').insert(
      defaultCats.map(c => ({ ...c, user_id: user!.id, profile_id: data.id }))
    );

    toast.success('Perfil criado');
    qc.invalidateQueries({ queryKey: qk.financialProfiles });
    qc.invalidateQueries({ queryKey: qk.categories.all });
  };

  const updateProfile = async (id: string, name: string, icon: string, color: string, pin?: string) => {
    const { error } = await supabase.from('financial_profiles').update({ name, icon, color, pin }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Perfil atualizado');
    qc.invalidateQueries({ queryKey: qk.financialProfiles });
  };

  const deleteProfile = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile?.is_default) { toast.error('Não é possível excluir o perfil padrão'); return; }
    const { error } = await supabase.from('financial_profiles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Perfil removido');
    qc.invalidateQueries({ queryKey: qk.financialProfiles });
    if (activeProfileId === id) {
      const def = profiles.find(p => p.is_default);
      if (def) handleSetActive(def.id);
    }
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null;

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      setActiveProfileId: handleSetActive,
      createProfile,
      updateProfile,
      deleteProfile,
      loading: isLoading,
      currentMonth,
      setCurrentMonth,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}
