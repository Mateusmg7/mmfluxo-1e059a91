import { useState } from 'react';
import {
  fetchTransactionsByPeriod,
  fetchAllTransactionsByPeriod,
} from '@/services/transactionsService';
import {
  fetchExtraIncomeByPeriod,
  fetchAllExtraIncomeByPeriod,
} from '@/services/extraIncomeService';
import { fetchGoals } from '@/services/goalsService';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';

import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download, FileText, BarChart3, PieChartIcon, Layers, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';
import { MonthlyComparisonChart } from '@/components/charts/MonthlyComparisonChart';
import { PieTooltip } from '@/components/charts/PieTooltip';
import { renderActiveSlice } from '@/components/charts/ActivePieSlice';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { exportPdf } from '@/lib/exportPdf';

const COLORS_MAP: Record<string, string> = {
  essencial: '#0C5BA8',
  lazer: '#8B5CF6',
  imprevisto: '#EAB308',
  besteira: '#F97316',
};

const TIPO_LABELS: Record<string, string> = {
  essencial: 'Essenciais',
  lazer: 'Lazer',
  imprevisto: 'Imprevistos',
  besteira: 'Besteiras',
};

const DISTINCT_CAT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeProfile, profiles } = useProfile();
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | undefined>(undefined);
  const [activeCatIdx, setActiveCatIdx] = useState<number | undefined>(undefined);
  const [activePieIdx, setActivePieIdx] = useState<number | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();
  
  const now = new Date();
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());
  const isCurrentMonth = isSameMonth(currentMonth, now);

  // Profile-scoped queries
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', monthStart, monthEnd, activeProfile?.id],
    queryFn: () =>
      fetchTransactionsByPeriod({
        profileId: activeProfile?.id,
        startDate: monthStart,
        endDate: monthEnd,
      }),
    enabled: !!user && !!activeProfile,
  });

  const { data: extraIncome = [] } = useQuery({
    queryKey: ['extra_income', monthStart, monthEnd, activeProfile?.id],
    queryFn: () =>
      fetchExtraIncomeByPeriod({
        profileId: activeProfile?.id,
        startDate: monthStart,
        endDate: monthEnd,
      }),
    enabled: !!user && !!activeProfile,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', activeProfile?.id],
    queryFn: () => fetchGoals(activeProfile?.id),
    enabled: !!user && !!activeProfile,
  });

  // All-profile queries (for Comparativo tab)
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all_transactions', monthStart, monthEnd],
    queryFn: () => fetchAllTransactionsByPeriod(monthStart, monthEnd),
    enabled: !!user,
  });

  const { data: allExtraIncome = [] } = useQuery({
    queryKey: ['all_extra_income', monthStart, monthEnd],
    queryFn: () => fetchAllExtraIncomeByPeriod(monthStart, monthEnd),
    enabled: !!user,
  });

  const totalDespesas = transactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = extraIncome.reduce((s, t) => s + Number(t.valor), 0);

  const tipoTotals = transactions.reduce((acc: Record<string, number>, t: any) => {
    const tipo = t.tipo_despesa ?? 'essencial';
    acc[tipo] = (acc[tipo] ?? 0) + Number(t.valor);
    return acc;
  }, {});

  const groupPieData = Object.entries(TIPO_LABELS)
    .map(([key, name]) => ({ name, value: tipoTotals[key] ?? 0, color: COLORS_MAP[key] }))
    .filter((d) => d.value > 0);
  const groupTotal = groupPieData.reduce((s, d) => s + d.value, 0);
  const groupPieDataWithPct = groupPieData.map(d => ({
    ...d, pct: groupTotal > 0 ? ((d.value / groupTotal) * 100).toFixed(1) : '0',
  }));

  const catMap = new Map<string, { nome: string; cor: string; total: number }>();
  let catIdx = 0;
  transactions.filter((t: any) => t.tipo_despesa === 'essencial' && t.categories).forEach((t: any) => {
    const name = t.categories?.nome ?? 'Outros';
    const existing = catMap.get(name);
    if (existing) existing.total += Number(t.valor);
    else {
      catMap.set(name, { nome: name, cor: DISTINCT_CAT_COLORS[catIdx % DISTINCT_CAT_COLORS.length], total: Number(t.valor) });
      catIdx++;
    }
  });
  const pieData = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const recentTransactions = transactions.slice(0, 5);

  // Reports data
  const weekMap = new Map<string, number>();
  transactions.forEach((t) => {
    const d = new Date(t.data + 'T00:00');
    const key = `Semana ${Math.ceil(d.getDate() / 7)}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + Number(t.valor));
  });
  const barData = Array.from(weekMap.entries()).map(([semana, total]) => ({ semana, total }));

  const groupData = Object.entries(TIPO_LABELS).map(([key, label]) => ({
    label,
    value: transactions.filter((t: any) => t.tipo_despesa === key).reduce((s, t) => s + Number(t.valor), 0),
    color: COLORS_MAP[key],
  }));

  const originMap = new Map<string, number>();
  extraIncome.forEach((r) => { originMap.set(r.origem, (originMap.get(r.origem) ?? 0) + Number(r.valor)); });
  const originData = Array.from(originMap.entries()).map(([origem, total]) => ({ origem, total })).sort((a, b) => b.total - a.total);

  // Comparativo data
  const allTotalDespesas = allTransactions.reduce((s, t) => s + Number(t.valor), 0);
  const allTotalRendaExtra = allExtraIncome.reduce((s, t) => s + Number(t.valor), 0);
  const profileData = profiles.map((p) => {
    const despesas = allTransactions.filter((t) => t.profile_id === p.id).reduce((s, t) => s + Number(t.valor), 0);
    const renda = allExtraIncome.filter((t) => t.profile_id === p.id).reduce((s, t) => s + Number(t.valor), 0);
    return { ...p, despesas, renda };
  });
  const comparBarData = profileData.map((p) => ({ name: `${p.icon} ${p.name}`, Despesas: p.despesas, 'Renda Extra': p.renda }));
  const allTipoTotals = allTransactions.reduce((acc: Record<string, number>, t: any) => {
    const tipo = t.tipo_despesa ?? 'essencial';
    acc[tipo] = (acc[tipo] ?? 0) + Number(t.valor);
    return acc;
  }, {});

  // Export functions
  const exportCSV = (rows: Record<string, any>[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const mesLabel = format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR });
    exportPdf({
      title: 'MM Fluxo — Relatório Mensal',
      subtitle: `${activeProfile?.name ?? 'Perfil'} · ${mesLabel}`,
      sections: [
        {
          heading: 'Despesas',
          columns: ['Data', 'Hora', 'Tipo', 'Categoria', 'Motivo', 'Valor', 'Status'],
          rows: transactions.map((t: any) => [
            t.data, t.hora, TIPO_LABELS[t.tipo_despesa] ?? 'Essencial', t.categories?.nome ?? '-', t.motivo || '-', fmt(Number(t.valor)), t.status,
          ]),
        },
        {
          heading: 'Renda Extra',
          columns: ['Data', 'Hora', 'Origem', 'Valor', 'Observação'],
          rows: extraIncome.map((r) => [r.data, r.hora, r.origem, fmt(Number(r.valor)), r.observacao ?? '']),
        },
      ],
      filename: `relatorio-${format(currentMonth, 'yyyy-MM')}.pdf`,
    });
  };

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, nome }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={500}>
        {nome} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with month nav */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground text-sm capitalize">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft size={18} />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs px-2">Hoje</Button>
          )}
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="animate-fade-up">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
        </TabsList>

        {/* ===== VISÃO GERAL ===== */}
        <TabsContent value="visao-geral" className="space-y-6">
          {/* Budget card */}
          {activeProfile && activeProfile.orcamento_mensal > 0 && (() => {
            const orcamento = activeProfile.orcamento_mensal;
            const restante = orcamento - totalDespesas;
            const pct = Math.min((totalDespesas / orcamento) * 100, 100);
            const estourou = restante < 0;
            const quaseEstourando = !estourou && pct >= 80;
            return (
              <Card className={`card-glass border-l-4 ${estourou ? 'border-l-destructive' : quaseEstourando ? 'border-l-warning' : 'border-l-accent'}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wallet size={18} className="text-primary" />
                      <span className="text-sm font-semibold">Orçamento Mensal</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(totalDespesas)} / {fmt(orcamento)}</span>
                  </div>
                  <Progress value={pct} className={`h-2.5 ${estourou ? '[&>div]:bg-destructive' : quaseEstourando ? '[&>div]:bg-warning' : '[&>div]:bg-accent'}`} />
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-sm font-bold ${estourou ? 'text-destructive' : 'text-accent'}`}>
                      {estourou ? `Estourou ${fmt(Math.abs(restante))}` : `Resta ${fmt(restante)}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% usado</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'Despesas', value: fmt(totalDespesas), cls: 'text-destructive', bg: 'bg-destructive/10', Icon: ArrowDownCircle },
              { label: 'Renda Extra', value: fmt(totalRendaExtra), cls: 'text-accent', bg: 'bg-accent/10', Icon: ArrowUpCircle },
              { label: 'Metas', value: String(goals.length), cls: 'text-foreground', bg: 'bg-primary/10', Icon: TrendingUp },
            ].map((c) => (
              <Card key={c.label} className="card-glass">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${c.bg}`}><c.Icon className={c.cls} size={20} /></div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{c.label}</p>
                      <p className={`text-lg font-bold ${c.cls}`}>{c.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>


          <MonthlyEvolutionChart userId={user!.id} profileId={activeProfile?.id} currentMonth={currentMonth} />
          <MonthlyComparisonChart userId={user!.id} profileId={activeProfile?.id} currentMonth={currentMonth} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribuição por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                {groupPieData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sem despesas no mês</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart onClick={() => setActiveGroupIdx(undefined)}>
                        <Pie data={groupPieDataWithPct} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0} activeShape={renderActiveSlice} activeIndex={activeGroupIdx} onMouseDown={(_, idx) => { setActiveGroupIdx(prev => prev === idx ? undefined : idx); }} rootTabIndex={-1}>
                          {groupPieDataWithPct.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip content={<PieTooltip fmt={fmt} />} active={activeGroupIdx !== undefined} />
                        <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 16 }} formatter={(value) => {
                          const item = groupPieDataWithPct.find(d => d.name === value);
                          return <span className="text-xs text-foreground">{value} {item ? `(${item.pct}%)` : ''}</span>;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Essenciais por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sem despesas essenciais no mês</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart onClick={() => setActiveCatIdx(undefined)}>
                        <Pie data={pieData} dataKey="total" nameKey="nome" cx="50%" cy="42%" innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0} activeShape={renderActiveSlice} activeIndex={activeCatIdx} onMouseDown={(_, idx) => { setActiveCatIdx(prev => prev === idx ? undefined : idx); }} rootTabIndex={-1}>
                          {pieData.map((entry, i) => (<Cell key={i} fill={entry.cor} />))}
                        </Pie>
                        <Tooltip content={<PieTooltip fmt={fmt} />} active={activeCatIdx !== undefined} />
                        <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 16 }} formatter={(value) => <span className="text-xs text-foreground">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(TIPO_LABELS).map(([key, label]) => {
              const value = tipoTotals[key] ?? 0;
              return (
                <Card key={key} className="card-glass">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_MAP[key] }} />
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                    <p className="text-xl font-bold" style={{ color: COLORS_MAP[key] }}>{fmt(value)}</p>
                    {totalDespesas > 0 && (
                      <div className="mt-2">
                        <Progress value={(value / totalDespesas) * 100} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">{((value / totalDespesas) * 100).toFixed(0)}% do total</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {recentTransactions.length > 0 && (
            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Últimas despesas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recentTransactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS_MAP[t.tipo_despesa] ?? '#666' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.motivo || t.categories?.nome || TIPO_LABELS[t.tipo_despesa]}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.data + 'T00:00'), 'dd/MM', { locale: ptBR })} às {t.hora?.slice(0, 5) || '00:00'} · {TIPO_LABELS[t.tipo_despesa] ?? 'Essencial'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-destructive flex-shrink-0">{fmt(Number(t.valor))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {goals.length > 0 && (
            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Progresso das Metas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {goals.map((goal: any) => {
                  let current = 0;
                  if (goal.tipo_meta === 'limite_despesas') current = totalDespesas;
                  else if (goal.tipo_meta === 'meta_renda_extra') current = totalRendaExtra;
                  else if (goal.tipo_meta === 'limite_categoria') {
                    current = transactions.filter((t) => t.category_id === goal.category_id).reduce((s, t) => s + Number(t.valor), 0);
                  }
                  const pct = Math.min((current / Number(goal.valor_alvo)) * 100, 100);
                  const isOver = current > Number(goal.valor_alvo);
                  const isLimit = goal.tipo_meta !== 'meta_renda_extra';
                  return (
                    <div key={goal.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{goal.nome_meta}</span>
                        <span className={isLimit && isOver ? 'text-destructive' : 'text-muted-foreground'}>{fmt(current)} / {fmt(Number(goal.valor_alvo))}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== RELATÓRIOS ===== */}
        <TabsContent value="relatorios" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleExportPdf} className="bg-primary hover:bg-primary/90"><FileText size={14} className="mr-1.5" />PDF</Button>
            <Button size="sm" variant="outline" onClick={() => exportCSV(transactions.map((t: any) => ({
              data: t.data, hora: t.hora, tipo: TIPO_LABELS[t.tipo_despesa] ?? '', categoria: t.categories?.nome ?? '', motivo: t.motivo ?? '', valor: t.valor, status: t.status,
            })), 'despesas.csv')}><Download size={14} className="mr-1.5" />Despesas</Button>
            <Button size="sm" variant="outline" onClick={() => exportCSV(extraIncome.map((r) => ({
              data: r.data, hora: r.hora, origem: r.origem, valor: r.valor, observacao: r.observacao ?? '',
            })), 'renda-extra.csv')}><Download size={14} className="mr-1.5" />Renda Extra</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Despesas', value: totalDespesas, color: 'destructive', Icon: ArrowDownCircle },
              { label: 'Renda Extra', value: totalRendaExtra, color: 'accent', Icon: ArrowUpCircle },
            ].map((c) => (
              <Card key={c.label} className="card-glass overflow-hidden">
                <CardContent className="pt-5 pb-4 relative">
                  <div className={`absolute top-0 left-0 w-full h-0.5 bg-${c.color}`} />
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-${c.color}/10`}><c.Icon className={`text-${c.color}`} size={20} /></div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{c.label}</p>
                      <p className={`text-lg font-bold text-${c.color}`}>{fmt(c.value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><PieChartIcon size={14} /> Essenciais por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart onClick={() => setActivePieIdx(undefined)}>
                        <Pie data={pieData} dataKey="total" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={85} strokeWidth={2} stroke="hsl(var(--background))" label={renderCustomLabel} activeShape={renderActiveSlice} activeIndex={activePieIdx} onMouseDown={(_, idx) => { setActivePieIdx(prev => prev === idx ? undefined : idx); }} rootTabIndex={-1}>
                          {pieData.map((entry, i) => (<Cell key={i} fill={entry.cor} />))}
                        </Pie>
                        <Tooltip content={<PieTooltip fmt={fmt} />} active={activePieIdx !== undefined} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><BarChart3 size={14} /> Despesas por Semana</CardTitle>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} barSize={32}>
                        <defs><linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(210 85% 50%)" stopOpacity={1} /><stop offset="100%" stopColor="hsl(210 85% 35%)" stopOpacity={0.8} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 20% 12%)" vertical={false} />
                        <XAxis dataKey="semana" tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                        <Tooltip formatter={(v: number) => [fmt(v), 'Total']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', color: 'hsl(var(--card-foreground))', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} itemStyle={{ color: 'hsl(var(--card-foreground))' }} labelStyle={{ color: 'hsl(var(--card-foreground))', fontWeight: 600 }} />
                        <Bar dataKey="total" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><TrendingUp size={14} /> Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupData.map((g) => (
                  <div key={g.label} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="text-sm font-medium">{g.label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: g.color }}>{fmt(g.value)}</span>
                    </div>
                    <Progress value={totalDespesas > 0 ? (g.value / totalDespesas) * 100 : 0} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{totalDespesas > 0 ? ((g.value / totalDespesas) * 100).toFixed(1) : 0}% do total</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ArrowUpCircle size={14} /> Renda Extra por Origem</CardTitle>
              </CardHeader>
              <CardContent>
                {originData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
                ) : (
                  <div className="space-y-3">
                    {originData.map(({ origem, total }, i) => (
                      <div key={origem} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-accent/5 border border-accent/10">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">{i + 1}</div>
                          <span className="text-sm font-medium">{origem}</span>
                        </div>
                        <span className="font-bold text-accent">{fmt(total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== COMPARATIVO ===== */}
        <TabsContent value="comparativo" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Despesas Totais', value: allTotalDespesas, cls: 'text-destructive', Icon: ArrowDownCircle, bg: 'bg-destructive/10' },
              { label: 'Renda Extra Total', value: allTotalRendaExtra, cls: 'text-accent', Icon: ArrowUpCircle, bg: 'bg-accent/10' },
            ].map((c) => (
              <Card key={c.label} className="card-glass">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${c.bg}`}><c.Icon className={c.cls} size={20} /></div>
                    <div><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.cls}`}>{fmt(c.value)}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {comparBarData.length > 1 && (
            <Card className="card-glass">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Comparativo por Perfil</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparBarData} barGap={4}>
                      <XAxis dataKey="name" tick={{ fill: 'hsl(232 10% 59%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))', fontSize: '13px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} itemStyle={{ color: 'hsl(var(--card-foreground))' }} labelStyle={{ color: 'hsl(var(--card-foreground))', fontWeight: 600 }} />
                      <Bar dataKey="Despesas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Renda Extra" fill="hsl(147 78% 39%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profileData.map((p) => (
              <Card key={p.id} className="card-glass border-l-4" style={{ borderLeftColor: p.color }}>
                <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><span className="text-lg">{p.icon}</span> {p.name}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Despesas</span><span className="text-destructive font-medium">{fmt(p.despesas)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Renda Extra</span><span className="text-accent font-medium">{fmt(p.renda)}</span></div>
                  {allTotalDespesas > 0 && p.despesas > 0 && (
                    <div>
                      <Progress value={(p.despesas / allTotalDespesas) * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">{((p.despesas / allTotalDespesas) * 100).toFixed(0)}% das despesas totais</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="card-glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribuição consolidada por tipo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(TIPO_LABELS).map(([key, label]) => {
                  const value = allTipoTotals[key] ?? 0;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_MAP[key] }} />
                        <span className="text-sm text-muted-foreground">{label}</span>
                      </div>
                      <p className="text-xl font-bold" style={{ color: COLORS_MAP[key] }}>{fmt(value)}</p>
                      {allTotalDespesas > 0 && (
                        <>
                          <Progress value={(value / allTotalDespesas) * 100} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">{((value / allTotalDespesas) * 100).toFixed(0)}% do total</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
