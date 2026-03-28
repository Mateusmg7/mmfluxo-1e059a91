import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TransacoesPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const now = new Date();

  const [periodo, setPeriodo] = useState('atual');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(format(now, 'yyyy-MM-dd'));
  const [hora, setHora] = useState(format(now, 'HH:mm'));
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('pago');

  const getDateRange = () => {
    if (periodo === 'anterior') {
      const prev = subMonths(now, 1);
      return { start: format(startOfMonth(prev), 'yyyy-MM-dd'), end: format(endOfMonth(prev), 'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  };

  const { start, end } = getDateRange();

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
    queryKey: ['transactions', start, end, activeProfile?.id],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*, categories(nome, grupo, cor_hex)')
        .gte('data', start)
        .lte('data', end)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const filtered = transactions.filter((t: any) => {
    if (filtroCategoria !== 'todas') {
      if (['essenciais', 'lazer', 'imprevistos', 'besteiras'].includes(filtroCategoria)) {
        if (t.categories?.grupo !== filtroCategoria) return false;
      } else {
        if (t.category_id !== filtroCategoria) return false;
      }
    }
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false;
    return true;
  });

  const total = filtered.reduce((s, t) => s + Number(t.valor), 0);

  const resetForm = () => {
    setCategoryId('');
    setValor('');
    setData(format(now, 'yyyy-MM-dd'));
    setHora(format(now, 'HH:mm'));
    setDescricao('');
    setStatus('pago');
    setEditId(null);
  };

  const handleSave = async () => {
    if (!categoryId || !valor) {
      toast.error('Preencha categoria e valor');
      return;
    }

    const payload = {
      user_id: user!.id,
      category_id: categoryId,
      valor: parseFloat(valor),
      data,
      hora,
      descricao,
      status,
      profile_id: activeProfile?.id,
    };

    if (editId) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Despesa atualizada');
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Despesa adicionada');
    }

    qc.invalidateQueries({ queryKey: ['transactions'] });
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (t: any) => {
    setEditId(t.id);
    setCategoryId(t.category_id);
    setValor(String(t.valor));
    setData(t.data);
    setHora(t.hora);
    setDescricao(t.descricao);
    setStatus(t.status);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Despesa removida');
    qc.invalidateQueries({ queryKey: ['transactions'] });
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Transações</h2>
          <p className="text-muted-foreground text-sm">Despesas do período</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Adicionar despesa</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Nova'} Despesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="previsto">Previsto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Supermercado" />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="atual">Mês atual</SelectItem>
            <SelectItem value="anterior">Mês anterior</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="essenciais">Essenciais</SelectItem>
            <SelectItem value="lazer">Lazer</SelectItem>
            <SelectItem value="imprevistos">Imprevistos</SelectItem>
            <SelectItem value="besteiras">Besteiras</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="previsto">Previsto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Total */}
      <Card className="card-glass">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total filtrado</span>
            <span className="text-xl font-bold text-destructive">{fmt(total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Nenhuma despesa encontrada.</p>
        )}
        {filtered.map((t: any) => (
          <Card key={t.id} className="card-glass">
            <CardContent className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.categories?.cor_hex ?? '#0C5BA8' }}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.descricao || t.categories?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.data + 'T00:00'), 'dd/MM', { locale: ptBR })} · {t.hora} · {t.categories?.nome}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="font-semibold text-destructive">{fmt(Number(t.valor))}</p>
                  <Badge variant={t.status === 'pago' ? 'default' : 'secondary'} className="text-xs">
                    {t.status}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(t)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
