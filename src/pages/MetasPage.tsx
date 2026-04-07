import { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Target } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type GoalType = Database['public']['Enums']['goal_type'];

const goalTypeLabels: Record<GoalType, string> = {
  limite_despesas: 'Limite de despesas',
  meta_renda_extra: 'Meta de renda extra',
  limite_categoria: 'Limite por categoria',
};

export default function MetasPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nomeMeta, setNomeMeta] = useState('');
  const [tipoMeta, setTipoMeta] = useState<GoalType>('limite_despesas');
  const [valorAlvo, setValorAlvo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [periodoTipo, setPeriodoTipo] = useState('mensal');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', activeProfile?.id],
    queryFn: async () => {
      let q = supabase.from('goals').select('*, categories(nome)');
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', activeProfile?.id],
    queryFn: async () => {
      let q = supabase.from('categories').select('*').order('nome');
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', monthStart, monthEnd, activeProfile?.id],
    queryFn: async () => {
      let q = supabase.from('transactions').select('*').gte('data', monthStart).lte('data', monthEnd);
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const { data: extraIncome = [] } = useQuery({
    queryKey: ['extra_income', monthStart, monthEnd, activeProfile?.id],
    queryFn: async () => {
      let q = supabase.from('extra_income').select('*').gte('data', monthStart).lte('data', monthEnd);
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const totalDespesas = transactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = extraIncome.reduce((s, r) => s + Number(r.valor), 0);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const resetForm = () => {
    setNomeMeta(''); setTipoMeta('limite_despesas'); setValorAlvo('');
    setCategoryId(''); setPeriodoTipo('mensal');
  };

  const handleSave = async () => {
    if (!nomeMeta || !valorAlvo) { toast.error('Preencha nome e valor'); return; }
    const { error } = await supabase.from('goals').insert({
      user_id: user!.id,
      nome_meta: nomeMeta,
      tipo_meta: tipoMeta,
      valor_alvo: parseFloat(valorAlvo),
      category_id: tipoMeta === 'limite_categoria' ? categoryId || null : null,
      periodo_tipo: periodoTipo,
      profile_id: activeProfile?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Meta criada');
    qc.invalidateQueries({ queryKey: ['goals'] });
    setDialogOpen(false);
    resetForm();
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('goals').delete().eq('id', deleteId);
    toast.success('Meta removida');
    qc.invalidateQueries({ queryKey: ['goals'] });
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const getProgress = (goal: any) => {
    let current = 0;
    if (goal.tipo_meta === 'limite_despesas') current = totalDespesas;
    else if (goal.tipo_meta === 'meta_renda_extra') current = totalRendaExtra;
    else if (goal.tipo_meta === 'limite_categoria') {
      current = transactions.filter((t) => t.category_id === goal.category_id).reduce((s, t) => s + Number(t.valor), 0);
    }
    const alvo = Number(goal.valor_alvo);
    const pct = Math.min((current / alvo) * 100, 100);
    const isLimit = goal.tipo_meta !== 'meta_renda_extra';
    const isOver = current > alvo;
    let statusLabel = 'Dentro';
    if (isLimit && isOver) statusLabel = 'Estourou';
    else if (isLimit && pct > 80) statusLabel = 'Quase';
    else if (!isLimit && current >= alvo) statusLabel = 'Atingida';
    return { current, pct, statusLabel, isOver, isLimit };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Metas</h2>
          <p className="text-muted-foreground text-sm">Controle seus limites e objetivos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Nova meta</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nomeMeta} onChange={(e) => setNomeMeta(e.target.value)} placeholder="Ex: Limite de Lazer" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipoMeta} onValueChange={(v) => setTipoMeta(v as GoalType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(goalTypeLabels)).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor alvo (R$)</Label>
                  <CurrencyInput value={valorAlvo} onChange={setValorAlvo} />
                </div>
              </div>
              {tipoMeta === 'limite_categoria' && (
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleSave} className="w-full">Criar meta</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma meta criada ainda.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal: any) => {
          const { current, pct, statusLabel, isOver, isLimit } = getProgress(goal);
          return (
            <Card key={goal.id} className="card-glass">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-primary" />
                    <div>
                      <p className="font-medium">{goal.nome_meta}</p>
                      <p className="text-xs text-muted-foreground">{goalTypeLabels[goal.tipo_meta as GoalType]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isLimit && isOver ? 'destructive' : 'secondary'} className="text-xs">{statusLabel}</Badge>
                    <button onClick={() => confirmDelete(goal.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {fmt(current)} de {fmt(Number(goal.valor_alvo))}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
