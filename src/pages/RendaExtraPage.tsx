import { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import {
  fetchExtraIncomeByPeriod,
  createExtraIncome,
  updateExtraIncome,
  deleteExtraIncome,
} from '@/services/extraIncomeService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowUpCircle, ChevronLeft, ChevronRight, Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

export default function RendaExtraPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const now = new Date();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [origem, setOrigem] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(format(now, 'yyyy-MM-dd'));
  const [hora, setHora] = useState(format(now, 'HH:mm'));
  const [observacao, setObservacao] = useState('');

  // 🔎 Filtros e busca
  const [busca, setBusca] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [ordem, setOrdem] = useState('');
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);

  const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());
  const isCurrentMonth = isSameMonth(currentMonth, now);

  const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: records = [] } = useQuery({
    queryKey: qk.extraIncome.byPeriod(activeProfile?.id, start, end),
    queryFn: () =>
      fetchExtraIncomeByPeriod({
        profileId: activeProfile?.id,
        startDate: start,
        endDate: end,
        withHourOrder: true,
      }),
    enabled: !!user && !!activeProfile,
  });

  // 🔎 Aplica busca + faixa de valor + ordenação
  const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const buscaNorm = normalizar(busca.trim());
  const minNum = valorMin ? parseFloat(valorMin.replace(',', '.')) : null;
  const maxNum = valorMax ? parseFloat(valorMax.replace(',', '.')) : null;

  const filtered = records.filter((r: any) => {
    const v = Number(r.valor);
    if (minNum !== null && !isNaN(minNum) && v < minNum) return false;
    if (maxNum !== null && !isNaN(maxNum) && v > maxNum) return false;
    if (buscaNorm) {
      const texto = normalizar(`${r.origem ?? ''} ${r.observacao ?? ''}`);
      if (!texto.includes(buscaNorm)) return false;
    }
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
      return (a.origem || '').toLowerCase().localeCompare((b.origem || '').toLowerCase()) * mult;
    }
    return 0;
  });

  const total = filtered.reduce((s, r) => s + Number(r.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const filtrosAtivos =
    (busca ? 1 : 0) + (valorMin ? 1 : 0) + (valorMax ? 1 : 0);

  const limparFiltros = () => {
    setBusca('');
    setValorMin('');
    setValorMax('');
  };

  const resetForm = () => {
    setOrigem(''); setValor(''); setData(format(now, 'yyyy-MM-dd'));
    setHora(format(now, 'HH:mm')); setObservacao(''); setEditId(null);
  };

  const handleSave = async () => {
    if (!origem || !valor) { toast.error('Preencha origem e valor'); return; }
    const payload = { user_id: user!.id, origem, valor: parseFloat(valor), data, hora, observacao: observacao || null, profile_id: activeProfile?.id };

    try {
      if (editId) {
        await updateExtraIncome(editId, payload);
        toast.success('Renda atualizada');
      } else {
        await createExtraIncome(payload);
        toast.success('Renda adicionada');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar');
      return;
    }
    qc.invalidateQueries({ queryKey: qk.extraIncome.all });
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (r: any) => {
    setEditId(r.id); setOrigem(r.origem); setValor(String(r.valor));
    setData(r.data); setHora(r.hora); setObservacao(r.observacao ?? '');
    setDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteExtraIncome(deleteId);
    toast.success('Removido');
    qc.invalidateQueries({ queryKey: qk.extraIncome.all });
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Renda Extra</h2>
          <p className="text-muted-foreground text-sm capitalize">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1 mr-auto sm:mr-0">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft size={18} />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs px-2">
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight size={18} />
          </Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90"><Plus size={16} className="mr-2" />Adicionar renda</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Nova'} Renda Extra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: Freela design" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <CurrencyInput value={valor} onChange={setValor} />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent/90">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>


      {/* 🔎 Caixa de busca + filtros avançados */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por origem ou observação..."
              className="pl-9 pr-9"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Select value={ordem} onValueChange={setOrdem}>
            <SelectTrigger className="w-44">
              <div className="flex items-center gap-1 min-w-0">
                <ArrowUpDown size={14} className="flex-shrink-0" />
                <span className="truncate">Ordenar por</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data-desc">Data (recente → antiga)</SelectItem>
              <SelectItem value="data-asc">Data (antiga → recente)</SelectItem>
              <SelectItem value="valor-desc">Valor (maior → menor)</SelectItem>
              <SelectItem value="valor-asc">Valor (menor → maior)</SelectItem>
              <SelectItem value="nome-asc">Origem (A → Z)</SelectItem>
              <SelectItem value="nome-desc">Origem (Z → A)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={filtrosAvancadosAbertos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltrosAvancadosAbertos((v) => !v)}
            className="gap-2"
          >
            <SlidersHorizontal size={14} />
            Filtros
            {filtrosAtivos > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                {filtrosAtivos}
              </span>
            )}
          </Button>
          {filtrosAtivos > 0 && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 text-muted-foreground">
              <X size={14} />
              Limpar
            </Button>
          )}
        </div>

        {filtrosAvancadosAbertos && (
          <Card className="card-glass">
            <CardContent className="py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={valorMin}
                    onChange={(e) => setValorMin(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Sem limite"
                    value={valorMax}
                    onChange={(e) => setValorMax(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="card-glass">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="text-accent" size={24} />
            <span className="text-muted-foreground">
              {filtrosAtivos > 0 ? 'Total filtrado' : 'Total no período'}
            </span>
          </div>
          <span className="text-xl font-bold text-accent">{fmt(total)}</span>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground">
              {records.length === 0
                ? 'Nenhuma renda extra neste mês.'
                : 'Nenhuma renda encontrada com esses filtros.'}
            </p>
            {records.length > 0 && filtrosAtivos > 0 && (
              <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-1">
                <X size={14} />
                Limpar filtros
              </Button>
            )}
          </div>
        )}
        {filtered.map((r: any) => (
          <Card key={r.id} className="card-glass">
            <CardContent className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.origem}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(r.data + 'T00:00'), 'dd/MM', { locale: ptBR })} · {r.hora}
                  {r.observacao && ` · ${r.observacao}`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-semibold text-accent">{fmt(Number(r.valor))}</span>
                <button onClick={() => handleEdit(r)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Pencil size={14} /></button>
                <button onClick={() => confirmDelete(r.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir esta renda extra? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
