import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

const TIPO_LABELS: Record<string, string> = {
  essencial: 'Essencial',
  lazer: 'Lazer',
  imprevisto: 'Imprevisto',
  besteira: 'Besteira',
};

const TIPO_COLORS: Record<string, string> = {
  essencial: '#0C5BA8',
  lazer: '#F97316',
  imprevisto: '#EF4444',
  besteira: '#A855F7',
};

export default function TransacoesPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const now = new Date();

  const [periodo, setPeriodo] = useState('atual');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [ordem, setOrdem] = useState('data-desc');

  // Form state
  const [tipoDespesa, setTipoDespesa] = useState('essencial');
  const [categoryId, setCategoryId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(format(now, 'yyyy-MM-dd'));
  const [hora, setHora] = useState(format(now, 'HH:mm'));
  const [status, setStatus] = useState('pago');
  const [recorrente, setRecorrente] = useState(false);

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
      let q = supabase.from('categories').select('*').eq('grupo', 'essenciais').order('nome');
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
        .select('*, categories(nome, cor_hex)')
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
    if (filtroTipo !== 'todos' && t.tipo_despesa !== filtroTipo) return false;
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false;
    return true;
  }).sort((a: any, b: any) => {
    const [campo, dir] = ordem.split('-');
    const mult = dir === 'asc' ? 1 : -1;
    if (campo === 'data') {
      const cmp = a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora);
      return cmp * mult;
    }
    if (campo === 'valor') return (Number(a.valor) - Number(b.valor)) * mult;
    if (campo === 'nome') {
      const nA = (a.motivo || a.categories?.nome || '').toLowerCase();
      const nB = (b.motivo || b.categories?.nome || '').toLowerCase();
      return nA.localeCompare(nB) * mult;
    }
    return 0;
  });

  const total = filtered.reduce((s, t) => s + Number(t.valor), 0);

  const resetForm = () => {
    setTipoDespesa('essencial');
    setCategoryId('');
    setMotivo('');
    setValor('');
    setData(format(now, 'yyyy-MM-dd'));
    setHora(format(now, 'HH:mm'));
    setStatus('pago');
    setRecorrente(false);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!valor) { toast.error('Preencha o valor'); return; }
    if (tipoDespesa === 'essencial' && !categoryId) { toast.error('Selecione a categoria'); return; }

    const payload: any = {
      user_id: user!.id,
      tipo_despesa: tipoDespesa,
      motivo,
      valor: parseFloat(valor),
      data,
      hora,
      descricao: motivo,
      status,
      recorrente,
      profile_id: activeProfile?.id,
      category_id: tipoDespesa === 'essencial' ? categoryId : null,
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
    setTipoDespesa(t.tipo_despesa ?? 'essencial');
    setCategoryId(t.category_id ?? '');
    setMotivo(t.motivo ?? '');
    setValor(String(t.valor));
    setData(t.data);
    setHora(t.hora);
    setStatus(t.status);
    setRecorrente(t.recorrente ?? false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Despesa removida');
    qc.invalidateQueries({ queryKey: ['transactions'] });
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getLabel = (t: any) => {
    if (t.motivo) return t.motivo;
    if (t.categories?.nome) return t.categories.nome;
    return TIPO_LABELS[t.tipo_despesa] ?? 'Despesa';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Despesas</h2>
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
                <Label>Tipo de despesa</Label>
                <Select value={tipoDespesa} onValueChange={(v) => { setTipoDespesa(v); if (v !== 'essencial') setCategoryId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essencial">Essencial</SelectItem>
                    <SelectItem value="lazer">Lazer</SelectItem>
                    <SelectItem value="imprevisto">Imprevisto</SelectItem>
                    <SelectItem value="besteira">Besteira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tipoDespesa === 'essencial' && (
                <div className="space-y-2">
                  <Label>Categoria Essencial</Label>
                  <div className="flex gap-2">
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <NewCategoryPopover
                      userId={user!.id}
                      profileId={activeProfile?.id ?? null}
                      onCreated={(id) => {
                        qc.invalidateQueries({ queryKey: ['categories'] });
                        setCategoryId(id);
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: conserto da moto, hambúrguer iFood" />
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
              <div className="flex items-center gap-2">
                <Checkbox id="recorrente" checked={recorrente} onCheckedChange={(v) => setRecorrente(!!v)} />
                <Label htmlFor="recorrente" className="text-sm cursor-pointer">Despesa recorrente</Label>
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
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="essencial">Essencial</SelectItem>
            <SelectItem value="lazer">Lazer</SelectItem>
            <SelectItem value="imprevisto">Imprevisto</SelectItem>
            <SelectItem value="besteira">Besteira</SelectItem>
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
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger className="w-48">
            <ArrowUpDown size={14} className="mr-1 flex-shrink-0" />
            <SelectValue placeholder="Ordenar Por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="data-desc">Data (recente → antiga)</SelectItem>
            <SelectItem value="data-asc">Data (antiga → recente)</SelectItem>
            <SelectItem value="valor-desc">Valor (maior → menor)</SelectItem>
            <SelectItem value="valor-asc">Valor (menor → maior)</SelectItem>
            <SelectItem value="nome-asc">Nome (A → Z)</SelectItem>
            <SelectItem value="nome-desc">Nome (Z → A)</SelectItem>
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
                  style={{ backgroundColor: TIPO_COLORS[t.tipo_despesa] ?? '#0C5BA8' }}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{getLabel(t)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.data + 'T00:00'), 'dd/MM', { locale: ptBR })} · {t.hora} · {TIPO_LABELS[t.tipo_despesa] ?? 'Essencial'}
                    {t.categories?.nome ? ` · ${t.categories.nome}` : ''}
                    {t.recorrente ? ' · 🔄 Recorrente' : ''}
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

function NewCategoryPopover({ userId, profileId, onCreated }: { userId: string; profileId: string | null; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Digite o nome da categoria'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('categories').insert({
      user_id: userId,
      profile_id: profileId,
      nome: nome.trim(),
      grupo: 'essenciais' as const,
    }).select('id').single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria criada');
    setNome('');
    setOpen(false);
    onCreated(data.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="flex-shrink-0" title="Nova categoria">
          <Plus size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <p className="text-sm font-medium">Nova categoria essencial</p>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Educação" onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">Criar</Button>
      </PopoverContent>
    </Popover>
  );
}
