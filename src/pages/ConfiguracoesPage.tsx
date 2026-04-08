import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sun, Moon, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/CurrencyInput';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mesInicio, setMesInicio] = useState('1');
  const [fuso, setFuso] = useState('America/Sao_Paulo');
  const [orcamento, setOrcamento] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setMesInicio(String(profile.mes_referencia_inicio));
      setFuso(profile.fuso_horario);
    }
  }, [profile]);

  useEffect(() => {
    if (activeProfile) {
      setOrcamento(activeProfile.orcamento_mensal ? String(activeProfile.orcamento_mensal) : '');
    }
  }, [activeProfile]);

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      name,
      email,
      mes_referencia_inicio: parseInt(mesInicio),
      fuso_horario: fuso,
    }).eq('user_id', user!.id);

    if (error) { toast.error(error.message); return; }
    toast.success('Configurações salvas');
    qc.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleSaveBudget = async () => {
    if (!activeProfile) return;
    const valor = orcamento ? parseFloat(orcamento) : 0;
    const { error } = await supabase.from('financial_profiles').update({
      orcamento_mensal: valor,
    }).eq('id', activeProfile.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Orçamento atualizado');
    qc.invalidateQueries({ queryKey: ['financial_profiles'] });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground text-sm">Ajuste seu perfil e preferências</p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet size={18} className="text-primary" /> Orçamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Defina um teto de gastos para o perfil <strong>{activeProfile?.icon} {activeProfile?.name}</strong>. O valor restante será exibido no Dashboard.
          </p>
          <div className="flex gap-2">
            <CurrencyInput
              value={orcamento}
              onChange={setOrcamento}
              placeholder="Ex: 3.000,00"
              className="flex-1"
            />
            <Button onClick={handleSaveBudget} size="sm">Salvar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled />
          </div>
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-base">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dia de início do mês</Label>
            <Select value={mesInicio} onValueChange={setMesInicio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Select value={fuso} onValueChange={setFuso}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-warning" />}
              <div>
                <p className="text-sm font-medium">Modo escuro</p>
                <p className="text-xs text-muted-foreground">Alternar entre tema claro e escuro</p>
              </div>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Salvar configurações</Button>
    </div>
  );
}
