import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: qk.profile,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mesInicio, setMesInicio] = useState('1');
  const [fuso, setFuso] = useState('America/Sao_Paulo');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setMesInicio(String(profile.mes_referencia_inicio || '1'));
      setFuso(profile.fuso_horario || 'America/Sao_Paulo');
    }
  }, [profile]);


  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('profiles').update({
      name,
      mes_referencia_inicio: parseInt(mesInicio),
      fuso_horario: fuso,
    }).eq('user_id', user.id);

    setIsSaving(false);
    if (error) { 
      toast.error(error.message); 
      return; 
    }
    toast.success('Configurações salvas');
    qc.invalidateQueries({ queryKey: qk.profile });
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl animate-fade-up">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground text-sm">Ajuste seu perfil e preferências</p>
      </div>

// Orçamento Mensal removido para ser gerenciado apenas no Dashboard

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={email} disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dia de início do mês</Label>
            <Select value={mesInicio} onValueChange={setMesInicio}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground px-1">Seus relatórios e dashboard considerarão este dia para fechar o mês.</p>
          </div>
          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Select value={fuso} onValueChange={setFuso}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fuso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                <SelectItem value="America/Manaus">Manaus (AMT)</SelectItem>
                <SelectItem value="America/Recife">Recife (BRT)</SelectItem>
                <SelectItem value="America/Cuiaba">Cuiabá (AMT)</SelectItem>
                <SelectItem value="America/Rio_Branco">Rio Branco (ACT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-full">
                {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-warning" />}
              </div>
              <div>
                <p className="text-sm font-medium">Modo escuro</p>
                <p className="text-[11px] text-muted-foreground">Alternar entre tema claro e escuro</p>
              </div>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      <div className="pt-2">
        <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar todas as configurações'}
        </Button>
      </div>
    </div>
  );
}
