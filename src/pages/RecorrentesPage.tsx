import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useRecurringExpenses } from '@/hooks/useRecurringExpenses';
import { fetchCategories } from '@/services/categoriesService';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { Plus, Pencil, Trash2, Repeat, PauseCircle, PlayCircle, Zap, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { sendTestPushNotification } from '@/hooks/usePushSubscription';

const TIPO_LABELS: Record<string, string> = {
  essencial: 'Essencial',
  lazer: 'Lazer',
  imprevisto: 'Imprevisto',
  besteira: 'Besteira',
};

const TIPO_COLORS: Record<string, string> = {
  essencial: '#0C5BA8',
  lazer: '#8B5CF6',
  imprevisto: '#EAB308',
  besteira: '#F97316',
};

interface FormState {
  nome: string;
  valor: string;
  dia: string;
  tipo: string;
  motivo: string;
  categoryId: string;
  ativo: boolean;
}

const emptyForm: FormState = {
  nome: '',
  valor: '',
  dia: '',
  tipo: 'essencial',
  motivo: '',
  categoryId: '',
  ativo: true,
};

export default function RecorrentesPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { rules, isLoading, addRule, updateRule, deleteRule } = useRecurringExpenses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: qk.categories.byProfile(activeProfile?.id),
    queryFn: () => fetchCategories({ profileId: activeProfile?.id, grupo: 'essenciais' }),
    enabled: !!user,
  });

  const totalMensal = useMemo(
    () => rules.filter((r) => r.ativo).reduce((s, r) => s + Number(r.valor || 0), 0),
    [rules]
  );

  const handleOpenNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return;
    setEditId(id);
    setForm({
      nome: r.nome,
      valor: String(r.valor),
      dia: String(r.dia_vencimento),
      tipo: r.tipo_despesa,
      motivo: r.motivo ?? '',
      categoryId: r.category_id ?? '',
      ativo: r.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da despesa');
      return;
    }
    const valorNum = parseFloat(form.valor);
    if (!valorNum || valorNum <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    const diaNum = parseInt(form.dia);
    if (!diaNum || diaNum < 1 || diaNum > 31) {
      toast.error('Dia do vencimento deve ser entre 1 e 31');
      return;
    }

    try {
      if (editId) {
        await updateRule.mutateAsync({
          id: editId,
          nome: form.nome.trim(),
          valor: valorNum,
          dia_vencimento: diaNum,
          tipo_despesa: form.tipo,
          motivo: form.motivo.trim(),
          category_id: form.tipo === 'essencial' && form.categoryId ? form.categoryId : null,
          ativo: form.ativo,
        });
        toast.success('Recorrente atualizada!');
      } else {
        await addRule.mutateAsync({
          nome: form.nome.trim(),
          valor: valorNum,
          dia_vencimento: diaNum,
          tipo_despesa: form.tipo,
          motivo: form.motivo.trim(),
          category_id: form.tipo === 'essencial' && form.categoryId ? form.categoryId : null,
          ativo: form.ativo,
        });
        toast.success('Recorrente cadastrada!');
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error('Erro ao salvar recorrente');
      console.error(e);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      await updateRule.mutateAsync({ id, ativo });
      toast.success(ativo ? 'Recorrente reativada' : 'Recorrente pausada');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const askDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRule.mutateAsync(deleteId);
      toast.success('Recorrente excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  // 🚀 Geração manual: chama a edge function com force=true para gerar AGORA
  // as despesas do mês corrente (útil pra estrear o sistema sem esperar o dia 1).
  const handleGenerateNow = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recurring-expenses', {
        body: { force: true, user_id: user.id },
      });
      if (error) throw error;
      const generated = (data as any)?.generated ?? 0;
      if (generated > 0) {
        toast.success(`${generated} despesa(s) gerada(s) para este mês!`);
      } else {
        toast.info('Nada novo para gerar — recorrentes deste mês já foram criadas.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar despesas. Tente novamente.');
    }
    setGenerating(false);
  };

  // 🔔 Envia um push de teste imediato pra validar se a notificação chega no dispositivo
  const handleSendTestPush = async () => {
    if (!user) return;
    setSendingTest(true);
    try {
      const ok = await sendTestPushNotification(user.id, {
        title: '🔔 Teste de notificação',
        body: 'Se você está vendo isso, o push está funcionando! 🎉',
        tag: `test-push-${Date.now()}`,
      });
      if (ok) {
        toast.success('Push de teste enviado! Veja a notificação no seu dispositivo.');
      } else {
        toast.error('Não foi possível enviar. Verifique permissões e re-assinatura.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar push de teste.');
    }
    setSendingTest(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Repeat size={24} className="text-primary" />
            Despesas Recorrentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre suas contas fixas e o app gera as despesas automaticamente todo mês.
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus size={16} />
          Nova Recorrente
        </Button>
      </div>

      {/* Resumo + Geração manual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total mensal estimado</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              R$ {totalMensal.toFixed(2).replace('.', ',')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {rules.filter((r) => r.ativo).length} de {rules.length} ativas
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex flex-col gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Geração automática</div>
            <p className="text-sm text-foreground">
              Roda no dia <strong>1</strong> de cada mês. Use o botão para gerar agora as deste mês.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateNow} disabled={generating}>
                <Zap size={14} />
                {generating ? 'Gerando...' : 'Gerar agora (mês atual)'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleSendTestPush} disabled={sendingTest}>
                <BellRing size={14} />
                {sendingTest ? 'Enviando...' : 'Enviar push de teste'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Repeat size={40} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">Nenhuma despesa recorrente cadastrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione contas fixas como aluguel, internet, streaming, academia...
              </p>
            </CardContent>
          </Card>
        ) : (
          rules.map((r) => {
            const tipoColor = TIPO_COLORS[r.tipo_despesa] ?? '#999';
            return (
              <Card key={r.id} className={r.ativo ? '' : 'opacity-60'}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div
                    className="w-1 self-stretch rounded-full"
                    style={{ backgroundColor: tipoColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{r.nome}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                        style={{ backgroundColor: `${tipoColor}22`, color: tipoColor }}
                      >
                        {TIPO_LABELS[r.tipo_despesa] ?? r.tipo_despesa}
                      </span>
                      {!r.ativo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                          Pausada
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Todo dia {r.dia_vencimento} · R${' '}
                      {Number(r.valor).toFixed(2).replace('.', ',')}
                      {r.categories?.nome && <> · {r.categories.nome}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleAtivo(r.id, !r.ativo)}
                      title={r.ativo ? 'Pausar' : 'Reativar'}
                    >
                      {r.ativo ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(r.id)} title="Editar">
                      <Pencil size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => askDelete(r.id)}
                      className="text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Recorrente' : 'Nova Recorrente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da despesa *</Label>
              <Input
                placeholder="Ex: Aluguel, Netflix, Academia"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor *</Label>
                <CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
              </div>
              <div>
                <Label>Dia do vencimento *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1-31"
                  value={form.dia}
                  onChange={(e) => setForm({ ...form, dia: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v, categoryId: v === 'essencial' ? form.categoryId : '' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.tipo === 'essencial' && (
              <div>
                <Label>Categoria (opcional)</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Observação (opcional)</Label>
              <Input
                placeholder="Ex: Plano família, contrato 12 meses..."
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desativada, não gera despesas automáticas.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={addRule.isPending || updateRule.isPending}>
                {editId ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Excluir recorrente?"
        description="A regra será removida e não gerará mais despesas. As despesas já criadas a partir dela continuam intactas."
      />
    </div>
  );
}
