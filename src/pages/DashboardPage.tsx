import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Label as ReLabel } from 'recharts';
import { MonthlyEvolutionChart } from '@/components/MonthlyEvolutionChart';
import { PieTooltip } from '@/components/PieTooltip';
import { renderActiveSlice } from '@/components/ActivePieSlice';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | undefined>(undefined);
  const [activeCatIdx, setActiveCatIdx] = useState<number | undefined>(undefined);
  const { activeProfile } = useProfile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const now = new Date();
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());
  const isCurrentMonth = isSameMonth(currentMonth, now);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', monthStart, monthEnd, activeProfile?.id],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*, categories(nome, cor_hex)')
        .gte('data', monthStart)
        .lte('data', monthEnd)
        .order('data', { ascending: false });
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

  const totalDespesas = transactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = extraIncome.reduce((s, t) => s + Number(t.valor), 0);
  

  // Group by tipo_despesa
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
    ...d,
    pct: groupTotal > 0 ? ((d.value / groupTotal) * 100).toFixed(1) : '0',
  }));

  // Distinct colors for essential categories
  const DISTINCT_CAT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

  // Pie by category (essenciais only)
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

  return (
    <div className="space-y-6">
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
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs px-2">
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 animate-fade-up">
        {[
          { label: 'Despesas', value: fmt(totalDespesas), cls: 'text-destructive', bg: 'bg-destructive/10', Icon: ArrowDownCircle, delay: '0.05s' },
          { label: 'Renda Extra', value: fmt(totalRendaExtra), cls: 'text-accent', bg: 'bg-accent/10', Icon: ArrowUpCircle, delay: '0.1s' },
          { label: 'Metas', value: String(goals.length), cls: 'text-foreground', bg: 'bg-primary/10', Icon: TrendingUp, delay: '0.15s' },
        ].map((c) => (
          <Card key={c.label} className="card-glass animate-fade-up" style={{ animationDelay: c.delay }}>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.25s' }}>
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
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(value, entry: any) => {
                        const item = groupPieDataWithPct.find(d => d.name === value);
                        return <span className="text-xs text-foreground">{value} {item ? `(${item.pct}%)` : ''}</span>;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.3s' }}>
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
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '0.35s' }}>
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

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.4s' }}>
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

      {/* Goals */}
      {goals.length > 0 && (
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.45s' }}>
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
    </div>
  );
}
