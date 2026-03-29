import { useState } from 'react';
import { useBillReminders } from '@/hooks/useBillReminders';
import { requestNotificationPermission } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AlertasPage() {
  const { reminders, isLoading, addReminder, updateReminder, deleteReminder, urgentReminders } = useBillReminders();
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('');

  const handleAdd = async () => {
    if (!nome.trim() || !dia) {
      toast.error('Preencha o nome e o dia de vencimento');
      return;
    }
    const diaNum = parseInt(dia);
    if (diaNum < 1 || diaNum > 31) {
      toast.error('Dia deve ser entre 1 e 31');
      return;
    }
    try {
      await addReminder.mutateAsync({
        nome: nome.trim(),
        valor: valor ? parseFloat(valor) : null,
        dia_vencimento: diaNum,
      });
      toast.success('Lembrete adicionado!');
      setNome('');
      setValor('');
      setDia('');
      setShowForm(false);
    } catch {
      toast.error('Erro ao adicionar lembrete');
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await updateReminder.mutateAsync({ id, ativo });
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder.mutateAsync(id);
      toast.success('Lembrete removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast.success('Notificações ativadas!');
    } else {
      toast.error('Permissão de notificação negada. Ative nas configurações do navegador.');
    }
  };

  const today = new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
        <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
          <Bell size={16} />
          Ativar Notificações
        </Button>
      </div>

      {/* Urgent alerts banner */}
      {urgentReminders.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              <span className="font-semibold text-yellow-500">Contas próximas do vencimento</span>
            </div>
            <div className="space-y-1">
              {urgentReminders.map((r) => (
                <div key={r.id} className="text-sm text-foreground">
                  <span className="font-medium">{r.nome}</span>
                  {r.valor && <span className="text-muted-foreground"> — R$ {r.valor.toFixed(2)}</span>}
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600">
                    {r.dia_vencimento === today ? 'HOJE' : 'AMANHÃ'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus size={16} />
          Novo Lembrete
        </Button>
      )}

      {/* Add form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo Lembrete de Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome da conta *</label>
              <Input placeholder="Ex: Internet, Luz, Aluguel" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Valor (opcional)</label>
                <Input type="number" placeholder="0.00" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dia do vencimento *</label>
                <Input type="number" placeholder="1-31" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={addReminder.isPending}>Salvar</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminders list */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : reminders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <BellOff size={40} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">Nenhum lembrete cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione lembretes para nunca esquecer de pagar suas contas</p>
            </CardContent>
          </Card>
        ) : (
          reminders.map((r) => {
            const isUrgent = r.ativo && (r.dia_vencimento === today || r.dia_vencimento === new Date(Date.now() + 86400000).getDate());
            return (
              <Card key={r.id} className={isUrgent ? 'border-yellow-500/40' : ''}>
                <CardContent className="py-3 flex items-center gap-3">
                  <Switch checked={r.ativo} onCheckedChange={(checked) => handleToggle(r.id, checked)} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${!r.ativo ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {r.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dia {r.dia_vencimento}
                      {r.valor && ` • R$ ${r.valor.toFixed(2)}`}
                    </p>
                  </div>
                  {isUrgent && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-medium shrink-0">
                      {r.dia_vencimento === today ? 'HOJE' : 'AMANHÃ'}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <Trash2 size={16} />
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
