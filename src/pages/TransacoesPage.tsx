import { useMemo, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useRecurringExpenses } from '@/hooks/useRecurringExpenses';
import {
  fetchTransactionsByPeriod,
  createTransaction,
  createTransactionsBatch,
  updateTransaction,
  deleteTransaction,
} from '@/services/transactionsService';
import { fetchCategories, createCategoryReturnId } from '@/services/categoriesService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, Search, X, SlidersHorizontal, Repeat, PauseCircle, PlayCircle, Zap, BellRing } from 'lucide-react';
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

export default function TransacoesPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const now = new Date();

  const [activeTab, setActiveTab] = useState('gastos');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editGrupoId, setEditGrupoId] = useState<string | null>(null);
  const [editTotalParcelas, setEditTotalParcelas] = useState(0);
  const [editParcelaAtual, setEditParcelaAtual] = useState('1');
  const [ordem, setOrdem] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());
  const isCurrentMonth = isSameMonth(currentMonth, now);

  const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  // Form state
  const [tipoDespesa, setTipoDespesa] = useState('essencial');
  const [categoryId, setCategoryId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(format(now, 'yyyy-MM-dd'));
  const [hora, setHora] = useState(format(now, 'HH:mm'));
  
  const [parcelado, setParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState('2');

  const { data: categories = [] } = useQuery({
    queryKey: qk.categories.byProfile(activeProfile?.id),
    queryFn: () => fetchCategories({ profileId: activeProfile?.id, grupo: 'essenciais' }),
    enabled: !!user && !!activeProfile,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: [...qk.categories.byProfile(activeProfile?.id), 'all-groups'],
    queryFn: () => fetchCategories({ profileId: activeProfile?.id }),
    enabled: !!user && !!activeProfile,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: qk.transactions.byPeriod(activeProfile?.id, start, end),
    queryFn: () =>
      fetchTransactionsByPeriod({
        profileId: activeProfile?.id,
        startDate: start,
        endDate: end,
        withHourOrder: true,
      }),
    enabled: !!user && !!activeProfile,
  });

  const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const buscaNorm = normalizar(busca.trim());
  const minNum = valorMin ? parseFloat(valorMin.replace(',', '.')) : null;
  const maxNum = valorMax ? parseFloat(valorMax.replace(',', '.')) : null;

  const filtered = transactions.filter((t: any) => {
    if (filtroTipo !== 'todos' && t.tipo_despesa !== filtroTipo) return false;
    if (filtroCategoria !== 'todas' && t.category_id !== filtroCategoria) return false;
    const v = Number(t.valor);
    if (minNum !== null && !isNaN(minNum) && v < minNum) return false;
    if (maxNum !== null && !isNaN(maxNum) && v > maxNum) return false;
    if (buscaNorm) {
      const texto = normalizar(`${t.motivo ?? ''} ${t.categories?.nome ?? ''}`);
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
      const nA = (a.motivo || a.categories?.nome || '').toLowerCase();
      const nB = (b.motivo || b.categories?.nome || '').toLowerCase();
      return nA.localeCompare(nB) * mult;
    }
    return 0;
  });

  const filtrosAtivos =
    (busca ? 1 : 0) +
    (filtroTipo !== 'todos' ? 1 : 0) +
    (filtroCategoria !== 'todas' ? 1 : 0) +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0);

  const limparFiltros = () => {
    setBusca('');
    setFiltroTipo('todos');
    setFiltroCategoria('todas');
    setValorMin('');
    setValorMax('');
  };

  const total = filtered.reduce((s, t) => s + Number(t.valor), 0);

  const resetForm = () => {
    setTipoDespesa('essencial');
    setCategoryId('');
    setMotivo('');
    setValor('');
    setData(format(now, 'yyyy-MM-dd'));
    setHora(format(now, 'HH:mm'));
    setParcelado(false);
    setTotalParcelas('2');
    setEditId(null);
    setEditGrupoId(null);
    setEditTotalParcelas(0);
    setEditParcelaAtual('1');
  };

  const handleSave = async () => {
    if (!valor) { toast.error('Preencha o valor'); return; }
    if (tipoDespesa === 'essencial' && !categoryId) { toast.error('Selecione a categoria'); return; }

    const valorNum = parseFloat(valor);
    const basePayload: any = {
      user_id: user!.id,
      tipo_despesa: tipoDespesa,
      motivo,
      descricao: motivo,
      status: 'pago',
      recorrente: false,
      profile_id: activeProfile?.id,
      category_id: tipoDespesa === 'essencial' ? categoryId : null,
    };

    try {
      if (editId) {
        const updatePayload: any = { ...basePayload, valor: valorNum, data, hora };
        if (editGrupoId && editTotalParcelas > 0) {
          updatePayload.parcela_atual = parseInt(editParcelaAtual) || 1;
        }
        await updateTransaction(editId, updatePayload);
        toast.success('Gasto atualizado');
      } else if (parcelado && !editId) {
        const numParcelas = Math.max(2, Math.min(48, parseInt(totalParcelas) || 2));
        const valorParcela = Math.round((valorNum / numParcelas) * 100) / 100;
        const grupoId = crypto.randomUUID();
        const parcelas = [];

        for (let i = 0; i < numParcelas; i++) {
          const dataParcela = format(addMonths(new Date(data + 'T12:00:00'), i), 'yyyy-MM-dd');
          parcelas.push({
            ...basePayload,
            valor: valorParcela,
            data: dataParcela,
            hora,
            parcela_atual: i + 1,
            total_parcelas: numParcelas,
            parcela_grupo_id: grupoId,
            status: i === 0 ? 'pago' : 'previsto',
          });
        }

        await createTransactionsBatch(parcelas);
        toast.success(`${numParcelas} parcelas de ${fmt(valorParcela)} criadas`);
      } else {
        await createTransaction({ ...basePayload, valor: valorNum, data, hora });
        toast.success('Gasto adicionado');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar');
      return;
    }

    qc.invalidateQueries({ queryKey: qk.transactions.all });
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
    setEditGrupoId(t.parcela_grupo_id ?? null);
    setEditTotalParcelas(t.total_parcelas ?? 0);
    setEditParcelaAtual(String(t.parcela_atual ?? 1));
    setDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTransaction(deleteId);
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao excluir');
      return;
    }
    toast.success('Gasto removido');
    qc.invalidateQueries({ queryKey: qk.transactions.all });
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getLabel = (t: any) => {
    if (t.motivo) return t.motivo;
    if (t.categories?.nome) return t.categories.nome;
    return TIPO_LABELS[t.tipo_despesa] ?? 'Gasto';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gastos</h2>
        <p className="text-muted-foreground text-sm">Gerencie seus gastos e recorrentes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="gastos" className="flex-1 sm:flex-auto">Gastos</TabsTrigger>
          <TabsTrigger value="automaticas" className="flex-1 sm:flex-auto gap-1">
            <Repeat size={14} />
            Recorrentes
          </TabsTrigger>
        </TabsList>

        {/* ===== ABA GASTOS ===== */}
        <TabsContent value="gastos" className="space-y-6 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
                <ChevronLeft size={18} />
              </Button>
              <span className="text-sm font-medium capitalize min-w-[140px] text-center">
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              {!isCurrentMonth && (
                <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs px-2">
                  Hoje
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
                <ChevronRight size={18} />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); qc.invalidateQueries({ queryKey: qk.transactions.all }); } }}>
              <DialogTrigger asChild>
                <Button><Plus size={16} className="mr-2" />Adicionar gasto</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{editId ? 'Editar' : 'Novo'} Gasto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de gasto</Label>
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
                            qc.invalidateQueries({ queryKey: qk.categories.all });
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
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <CurrencyInput value={valor} onChange={setValor} />
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
                  {!editId && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="parcelado" checked={parcelado} onCheckedChange={(v) => { setParcelado(!!v); if (!v) setTotalParcelas('2'); }} />
                      <Label htmlFor="parcelado" className="text-sm cursor-pointer">Parcelado</Label>
                    </div>
                  )}
                  {parcelado && !editId && (
                    <div className="space-y-2">
                      <Label>Número de parcelas</Label>
                      <Input
                        type="number"
                        min="2"
                        max="48"
                        value={totalParcelas}
                        onChange={(e) => setTotalParcelas(e.target.value)}
                        placeholder="Ex: 12"
                      />
                      {valor && parseInt(totalParcelas) >= 2 && (
                        <p className="text-xs text-muted-foreground">
                          {parseInt(totalParcelas)}x de {fmt(Math.round((parseFloat(valor) / parseInt(totalParcelas)) * 100) / 100)}
                        </p>
                      )}
                    </div>
                  )}
                  {editId && editGrupoId && editTotalParcelas > 0 && (
                    <div className="space-y-2">
                      <Label>Parcela atual</Label>
                      <Select value={editParcelaAtual} onValueChange={setEditParcelaAtual}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: editTotalParcelas }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {i + 1}/{editTotalParcelas}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={handleSave} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Busca + filtros */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por motivo ou categoria..."
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
                  <SelectItem value="nome-asc">Nome (A → Z)</SelectItem>
                  <SelectItem value="nome-desc">Nome (Z → A)</SelectItem>
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
                <CardContent className="py-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Tipo de gasto</Label>
                      <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os tipos</SelectItem>
                          <SelectItem value="essencial">Essencial</SelectItem>
                          <SelectItem value="lazer">Lazer</SelectItem>
                          <SelectItem value="imprevisto">Imprevisto</SelectItem>
                          <SelectItem value="besteira">Besteira</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas as categorias</SelectItem>
                          {allCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
                      <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
                      <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Sem limite" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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

          {/* Lista de gastos */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">
                  {transactions.length === 0
                    ? 'Nenhum gasto neste mês.'
                    : 'Nenhum gasto encontrado com esses filtros.'}
                </p>
                {transactions.length > 0 && filtrosAtivos > 0 && (
                  <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-1">
                    <X size={14} />
                    Limpar filtros
                  </Button>
                )}
              </div>
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
                        {t.recurring_id ? ' · 🔄 Recorrente' : ''}
                        {t.total_parcelas ? ` · 💳 ${t.parcela_atual}/${t.total_parcelas}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-semibold text-destructive">{fmt(Number(t.valor))}</p>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(t)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => confirmDelete(t.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDelete}
            description="Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita."
          />
        </TabsContent>

        {/* ===== ABA AUTOMÁTICAS ===== */}
        <TabsContent value="automaticas" className="mt-4">
          <RecurringSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ======================== Seção Recorrentes (embutida) ======================== */

interface RecFormState {
  nome: string;
  valor: string;
  dia: string;
  tipo: string;
  motivo: string;
  categoryId: string;
  ativo: boolean;
}

const emptyRecForm: RecFormState = {
  nome: '',
  valor: '',
  dia: '',
  tipo: 'essencial',
  motivo: '',
  categoryId: '',
  ativo: true,
};

function RecurringSection() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { rules, isLoading, addRule, updateRule, deleteRule } = useRecurringExpenses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RecFormState>(emptyRecForm);

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

  const handleOpenNew = () => { setEditId(null); setForm(emptyRecForm); setDialogOpen(true); };

  const handleOpenEdit = (id: string) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return;
    setEditId(id);
    setForm({ nome: r.nome, valor: String(r.valor), dia: String(r.dia_vencimento), tipo: r.tipo_despesa, motivo: r.motivo ?? '', categoryId: r.category_id ?? '', ativo: r.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome da despesa'); return; }
    const valorNum = parseFloat(form.valor);
    if (!valorNum || valorNum <= 0) { toast.error('Informe um valor válido'); return; }
    const diaNum = parseInt(form.dia);
    if (!diaNum || diaNum < 1 || diaNum > 31) { toast.error('Dia do vencimento deve ser entre 1 e 31'); return; }

    try {
      const payload = {
        nome: form.nome.trim(), valor: valorNum, dia_vencimento: diaNum, tipo_despesa: form.tipo,
        motivo: form.motivo.trim(), category_id: form.tipo === 'essencial' && form.categoryId ? form.categoryId : null, ativo: form.ativo,
      };
      if (editId) {
        await updateRule.mutateAsync({ id: editId, ...payload });
        toast.success('Recorrente atualizada!');
      } else {
        await addRule.mutateAsync(payload);
        toast.success('Recorrente cadastrada!');
      }
      setDialogOpen(false);
    } catch { toast.error('Erro ao salvar recorrente'); }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try { await updateRule.mutateAsync({ id, ativo }); toast.success(ativo ? 'Reativada' : 'Pausada'); } catch { toast.error('Erro ao atualizar'); }
  };

  const askDelete = (id: string) => { setDeleteId(id); setDeleteDialogOpen(true); };
  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteRule.mutateAsync(deleteId); toast.success('Recorrente excluída'); } catch { toast.error('Erro ao excluir'); }
    setDeleteDialogOpen(false); setDeleteId(null);
  };

  const handleGenerateNow = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recurring-expenses', { body: { force: true, user_id: user.id } });
      if (error) throw error;
      const generated = (data as any)?.generated ?? 0;
      if (generated > 0) toast.success(`${generated} despesa(s) gerada(s) para este mês!`);
      else toast.info('Nada novo para gerar — recorrentes deste mês já foram criadas.');
    } catch { toast.error('Erro ao gerar despesas. Tente novamente.'); }
    setGenerating(false);
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setSendingTest(true);
    try {
      const ok = await sendTestPushNotification(user.id, { title: '🔔 Teste de notificação', body: 'Se você está vendo isso, o push está funcionando! 🎉', tag: `test-push-${Date.now()}` });
      if (ok) toast.success('Push de teste enviado!');
      else toast.error('Não foi possível enviar. Verifique permissões.');
    } catch { toast.error('Erro ao enviar push de teste.'); }
    setSendingTest(false);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre suas contas fixas e o app gera os gastos automaticamente todo mês.
        </p>
        <Button onClick={handleOpenNew} size="sm">
          <Plus size={16} />
          Nova Recorrente
        </Button>
      </div>

      {/* Resumo + Geração manual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total mensal estimado</div>
            <div className="text-2xl font-bold text-foreground mt-1">{fmt(totalMensal)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {rules.filter((r) => r.ativo).length} de {rules.length} ativas
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex flex-col gap-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Geração recorrente</div>
            <p className="text-sm text-foreground">
              Roda no dia <strong>1</strong> de cada mês. Use o botão para gerar agora.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateNow} disabled={generating}>
                <Zap size={14} />
                {generating ? 'Gerando...' : 'Gerar agora'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleSendTestPush} disabled={sendingTest}>
                <BellRing size={14} />
                {sendingTest ? 'Enviando...' : 'Push de teste'}
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
              <p className="text-muted-foreground">Nenhum gasto recorrente cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione contas fixas como aluguel, internet, streaming, academia...</p>
            </CardContent>
          </Card>
        ) : (
          rules.map((r) => {
            const tipoColor = TIPO_COLORS[r.tipo_despesa] ?? '#999';
            return (
              <Card key={r.id} className={r.ativo ? '' : 'opacity-60'}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: tipoColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{r.nome}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: `${tipoColor}22`, color: tipoColor }}>
                        {TIPO_LABELS[r.tipo_despesa] ?? r.tipo_despesa}
                      </span>
                      {!r.ativo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">Pausada</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Todo dia {r.dia_vencimento} · {fmt(Number(r.valor))}
                      {r.categories?.nome && <> · {r.categories.nome}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => handleToggleAtivo(r.id, !r.ativo)} title={r.ativo ? 'Pausar' : 'Reativar'}>
                      {r.ativo ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(r.id)} title="Editar">
                      <Pencil size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => askDelete(r.id)} className="text-destructive hover:text-destructive" title="Excluir">
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
              <Label>Nome do gasto *</Label>
              <Input placeholder="Ex: Aluguel, Netflix, Academia" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor *</Label>
                <CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
              </div>
              <div>
                <Label>Dia do vencimento *</Label>
                <Input type="number" min="1" max="31" placeholder="1-31" value={form.dia} onChange={(e) => setForm({ ...form, dia: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v, categoryId: v === 'essencial' ? form.categoryId : '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'essencial' && (
              <div>
                <Label>Categoria (opcional)</Label>
                <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Observação (opcional)</Label>
              <Input placeholder="Ex: Plano família, contrato 12 meses..." value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">Ativa</Label>
                <p className="text-xs text-muted-foreground">Quando desativada, não gera gastos recorrentes.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
        description="A regra será removida e não gerará mais gastos. Os gastos já criados continuam intactos."
      />
    </div>
  );
}

/* ======================== Nova Categoria (inline) ======================== */

function NewCategoryPopover({ userId, profileId, onCreated }: { userId: string; profileId: string | null; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Digite o nome da categoria'); return; }
    setSaving(true);
    let newId: string;
    try {
      newId = await createCategoryReturnId({
        user_id: userId,
        profile_id: profileId,
        nome: nome.trim(),
        grupo: 'essenciais' as const,
      });
    } catch (err: any) {
      setSaving(false);
      toast.error(err?.message ?? 'Erro ao criar');
      return;
    }
    setSaving(false);
    toast.success('Categoria criada');
    setNome('');
    setOpen(false);
    onCreated(newId);
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
