import { useState, useEffect, useCallback } from 'react';
import { useBillReminders, BillReminder } from '@/hooks/useBillReminders';
import { requestNotificationPermission, sendTestNotification } from '@/hooks/useNotifications';
import { sendTestPushNotification } from '@/hooks/usePushSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Bell, BellOff, Plus, Trash2, Pencil, AlertTriangle, Send, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function AlertasPage() {
  const { user } = useAuth();
  const { reminders, isLoading, addReminder, updateReminder, deleteReminder, urgentReminders } = useBillReminders();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('');
  const [testReminderId, setTestReminderId] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Notification interval state
  const [notifInterval, setNotifInterval] = useState<number>(9);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [lastPushSentAt, setLastPushSentAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  const loadNotificationSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('profiles')
      .select('notif_interval_hours, notifications_enabled, last_push_sent_at')
      .eq('user_id', user.id)
      .single();

    if (typeof data?.notif_interval_hours === 'number') setNotifInterval(data.notif_interval_hours);
    if (typeof data?.notifications_enabled === 'boolean') setNotificationsEnabled(data.notifications_enabled);
    if (data?.last_push_sent_at !== undefined) setLastPushSentAt(data.last_push_sent_at);
  }, [user]);

  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(() => {
      loadNotificationSettings();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [loadNotificationSettings, user]);

  // Live countdown timer
  useEffect(() => {
    if (!lastPushSentAt || !notificationsEnabled) {
      setCountdown('');
      return;
    }
    const tick = () => {
      const lastTime = new Date(lastPushSentAt).getTime();
      const intervalMs = notifInterval * 3600000;
      const now = Date.now();
      // Find the next future notification time
      const cyclesPassed = Math.floor((now - lastTime) / intervalMs);
      const nextTime = lastTime + (cyclesPassed + 1) * intervalMs;
      const diffMs = nextTime - now;
      if (diffMs <= 0) {
        setCountdown('0s');
        return;
      }
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      const diffS = Math.floor((diffMs % 60000) / 1000);
      if (diffH > 0) {
        setCountdown(`${diffH}h ${diffM}min ${diffS}s`);
      } else if (diffM > 0) {
        setCountdown(`${diffM}min ${diffS}s`);
      } else {
        setCountdown(`${diffS}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastPushSentAt, notifInterval, notificationsEnabled]);

  const handleIntervalChange = async (value: string) => {
    const hours = parseFloat(value);
    setNotifInterval(hours);
    setIntervalLoading(true);
    try {
      await (supabase as any).from('profiles').update({ notif_interval_hours: hours }).eq('user_id', user!.id);
      toast.success(`Intervalo de notificação atualizado para ${hours}h`);
    } catch {
      toast.error('Erro ao atualizar intervalo');
    }
    setIntervalLoading(false);
  };

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
      resetForm();
    } catch {
      toast.error('Erro ao adicionar lembrete');
    }
  };

  const resetForm = () => {
    setNome('');
    setValor('');
    setDia('');
    setShowForm(false);
  };

  const handleEdit = (r: BillReminder) => {
    setEditId(r.id);
    setNome(r.nome);
    setValor(r.valor ? String(r.valor) : '');
    setDia(String(r.dia_vencimento));
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
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
      await updateReminder.mutateAsync({
        id: editId!,
        nome: nome.trim(),
        valor: valor ? parseFloat(valor) : null,
        dia_vencimento: diaNum,
      });
      toast.success('Lembrete atualizado!');
      setEditDialogOpen(false);
      setEditId(null);
      setNome('');
      setValor('');
      setDia('');
    } catch {
      toast.error('Erro ao atualizar lembrete');
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await updateReminder.mutateAsync({ id, ativo });
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteReminder.mutateAsync(deleteId);
      toast.success('Lembrete removido');
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const handleToggleNotifications = async () => {
    if (!user) return;
    setNotifLoading(true);
    const newValue = !notificationsEnabled;

    try {
      await (supabase as any).from('profiles').update({ notifications_enabled: newValue }).eq('user_id', user.id);
      setNotificationsEnabled(newValue);
      toast.success(newValue ? 'Notificações ativadas!' : 'Notificações desativadas!');
    } catch {
      toast.error('Erro ao atualizar notificações');
    }
    setNotifLoading(false);
  };

  const today = new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
        <Button
          variant={notificationsEnabled ? "destructive" : "outline"}
          size="sm"
          onClick={handleToggleNotifications}
          disabled={notifLoading}
          className={!notificationsEnabled ? "opacity-50" : ""}
        >
          {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          {notificationsEnabled ? 'Desativar Notificações' : 'Ativar Notificações'}
        </Button>
      </div>

      {reminders.length > 0 && (
        <Card>
          <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <Send size={14} />
              Testar Notificação
            </div>
            <Select value={testReminderId ?? undefined} onValueChange={setTestReminderId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Selecione um lembrete" />
              </SelectTrigger>
              <SelectContent>
                {reminders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome} — Dia {r.dia_vencimento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!testReminderId}
              onClick={async () => {
                const r = reminders.find(rem => rem.id === testReminderId);
                if (!r || !user) return;

                const granted = await requestNotificationPermission();
                if (!granted) {
                  toast.error('Permissão de notificação negada. Ative nas configurações do navegador.');
                  return;
                }

                const today = new Date().getDate();
                const tomorrow = new Date(Date.now() + 86400000).getDate();
                const isToday = r.dia_vencimento === today;
                const isTomorrow = r.dia_vencimento === tomorrow;
                const label = isToday ? 'Conta vencendo hoje' : isTomorrow ? 'Conta vencendo amanhã' : `Conta vence dia ${r.dia_vencimento}`;
                const valorStr = r.valor ? ` - R$ ${r.valor.toFixed(2)}` : '';

                const pushSent = await sendTestPushNotification(user.id, {
                  title: `💰 ${label}`,
                  body: `${r.nome}${valorStr}`,
                  tag: `test-${r.id}-${Date.now()}`,
                });

                if (pushSent) {
                  toast.success(`🔔 Notificação push enviada: ${r.nome}`);
                } else {
                  const sent = await sendTestNotification(r);
                  if (sent) {
                    toast.success(`🔔 Notificação enviada: ${r.nome}`);
                  } else {
                    toast.error('Não foi possível enviar a notificação. Verifique se as notificações estão ativadas.');
                  }
                }
              }}
            >
              TESTAR
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configuração do intervalo de notificação automática */}
      <Card>
        <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
            <Clock size={14} />
            Notificação Automática
          </div>
          <Select value={String(notifInterval)} onValueChange={handleIntervalChange} disabled={intervalLoading}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.0167">A cada 1 minuto (teste)</SelectItem>
              <SelectItem value="1">A cada 1 hora</SelectItem>
              <SelectItem value="2">A cada 2 horas</SelectItem>
              <SelectItem value="3">A cada 3 horas</SelectItem>
              <SelectItem value="6">A cada 6 horas</SelectItem>
              <SelectItem value="9">A cada 9 horas</SelectItem>
              <SelectItem value="12">A cada 12 horas</SelectItem>
              <SelectItem value="24">A cada 24 horas</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Notifica 1 dia antes e no dia do vencimento</span>
        </CardContent>
      </Card>

      {/* Indicador da próxima notificação */}
      {notificationsEnabled && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-3">
            <Bell size={16} className="text-primary shrink-0" />
            <div className="text-sm">
              {lastPushSentAt ? (
                <>
                  <span className="text-muted-foreground">Última notificação: </span>
                  <span className="font-medium text-foreground">
                    {new Date(lastPushSentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                   <span className="text-muted-foreground"> · Próxima em: </span>
                   <span className="font-medium text-primary animate-pulse">
                     {countdown || 'Calculando...'}
                   </span>
                </>
              ) : (
                <span className="text-muted-foreground">Nenhuma notificação enviada ainda. A próxima será verificada em breve.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus size={16} />
          Novo Lembrete
        </Button>
      )}

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
              <Button variant="outline" onClick={() => { resetForm(); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} className="shrink-0 text-muted-foreground">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => confirmDelete(r.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <Trash2 size={16} />
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditId(null); setNome(''); setValor(''); setDia(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lembrete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Button onClick={handleEditSave} disabled={updateReminder.isPending}>Salvar</Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir este lembrete? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
