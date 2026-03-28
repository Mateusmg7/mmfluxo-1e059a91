import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface FinancialProfile {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

interface ProfileContextType {
  profiles: FinancialProfile[];
  activeProfile: FinancialProfile | null;
  setActiveProfileId: (id: string) => void;
  createProfile: (name: string, icon: string, color: string) => Promise<void>;
  updateProfile: (id: string, name: string, icon: string, color: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfileId: () => {},
  createProfile: async () => {},
  updateProfile: async () => {},
  deleteProfile: async () => {},
  loading: true,
});

export const useProfile = () => useContext(ProfileContext);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    return localStorage.getItem('mm_active_profile');
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['financial_profiles'],
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
    if (profiles.length > 0 && !profiles.find(p => p.id === activeProfileId)) {
      const def = profiles.find(p => p.is_default) ?? profiles[0];
      setActiveProfileId(def.id);
      localStorage.setItem('mm_active_profile', def.id);
    }
  }, [profiles, activeProfileId]);

  const handleSetActive = (id: string) => {
    setActiveProfileId(id);
    localStorage.setItem('mm_active_profile', id);
    // Invalidate all data queries so they refetch with new profile
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['extra_income'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['goals'] });
  };

  const createProfile = async (name: string, icon: string, color: string) => {
    if (profiles.length >= 5) {
      toast.error('Máximo de 5 perfis atingido');
      return;
    }
    const { data, error } = await supabase.from('financial_profiles').insert({
      user_id: user!.id, name, icon, color,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // Create default categories for the new profile
    const defaultCats = [
      { nome: 'Moradia', cor_hex: '#3B82F6', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Mercado', cor_hex: '#F59E0B', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Transporte', cor_hex: '#8B5CF6', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Contas', cor_hex: '#EC4899', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Saúde', cor_hex: '#10B981', grupo: 'essenciais' as const, is_default: true },
      { nome: 'Lazer', cor_hex: '#F97316', grupo: 'lazer' as const, is_default: true },
      { nome: 'Imprevistos', cor_hex: '#EF4444', grupo: 'imprevistos' as const, is_default: true },
    ];
    await supabase.from('categories').insert(
      defaultCats.map(c => ({ ...c, user_id: user!.id, profile_id: data.id }))
    );

    toast.success('Perfil criado');
    qc.invalidateQueries({ queryKey: ['financial_profiles'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const updateProfile = async (id: string, name: string, icon: string, color: string) => {
    const { error } = await supabase.from('financial_profiles').update({ name, icon, color }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Perfil atualizado');
    qc.invalidateQueries({ queryKey: ['financial_profiles'] });
  };

  const deleteProfile = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile?.is_default) { toast.error('Não é possível excluir o perfil padrão'); return; }
    const { error } = await supabase.from('financial_profiles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Perfil removido');
    qc.invalidateQueries({ queryKey: ['financial_profiles'] });
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
    }}>
      {children}
    </ProfileContext.Provider>
  );
}
