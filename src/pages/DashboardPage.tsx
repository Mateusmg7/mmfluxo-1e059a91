import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';

const COLORS_MAP: Record<string, string> = {
  essenciais: '#0C5BA8',
  lazer: '#F97316',
  imprevistos: '#EF4444',
  besteiras: '#A855F7',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', monthStart, monthEnd, activeProfile?.id],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*, categories(nome, grupo, cor_hex)')
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
      let q = supabase
        .from('extra_income')
        .select('*')
        .gte('data', monthStart)
        .lte('data', monthEnd);
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
  const saldo = totalRendaExtra - totalDespesas;

  const essenciais = transactions
    .filter((t: any) => t.categories?.grupo === 'essenciais')
    .reduce((s, t) => s + Number(t.valor), 0);
  const lazer = transactions
    .filter((t: any) => t.categories?.grupo === 'lazer')
    .reduce((s, t) => s + Number(t.valor), 0);
  const imprevistos = transactions
    .filter((t: any) => t.categories?.grupo === 'imprevistos')
    .reduce((s, t) => s + Number(t.valor), 0);
  const besteiras = transactions
    .filter((t: any) => t.categories?.grupo === 'besteiras')
    .reduce((s, t) => s + Number(t.valor), 0);

  // Pie chart data by category
  const catMap = new Map<string, { nome: string; cor: string; total: number }>();
  transactions.forEach((t: any) => {
    const name = t.categories?.nome ?? 'Outros';
    const existing = catMap.get(name);
    if (existing) existing.total += Number(t.valor);
    else catMap.set(name, { nome: name, cor: t.categories?.cor_hex ?? '#666', total: Number(t.valor) });
  });
  const pieData = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

  // Pie data for groups
  const groupPieData = [
    { name: 'Essenciais', value: essenciais, color: COLORS_MAP.essenciais },
    { name: 'Lazer', value: lazer, color: COLORS_MAP.lazer },
    { name: 'Imprevistos', value: imprevistos, color: COLORS_MAP.imprevistos },
    { name: 'Besteiras', value: besteiras, color: COLORS_MAP.besteiras },
  ].filter((d) => d.value > 0);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm capitalize">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="card-glass">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ArrowDownCircle className="text-destructive" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-destructive">{fmt(totalDespesas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <ArrowUpCircle className="text-accent" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Renda Extra</p>
                <p className="text-lg font-bold text-accent">{fmt(totalRendaExtra)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-lg font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {fmt(saldo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'hsl(187 82% 54% / 0.1)' }}>
                <TrendingUp className="text-cyan" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Metas</p>
                <p className="text-lg font-bold">{goals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie by group */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribuição por grupo</CardTitle>
          </CardHeader>
          <CardContent>
            {groupPieData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">Sem despesas no mês</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {groupPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(216 30% 8%)',
                        border: '1px solid hsl(216 20% 16%)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                    <Legend
                      formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie by category */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">Sem despesas no mês</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="total"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(216 30% 8%)',
                        border: '1px solid hsl(216 20% 16%)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                    <Legend
                      formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Essenciais', value: essenciais, color: COLORS_MAP.essenciais },
          { label: 'Lazer', value: lazer, color: COLORS_MAP.lazer },
          { label: 'Imprevistos', value: imprevistos, color: COLORS_MAP.imprevistos },
        ].map((item) => (
          <Card key={item.label} className="card-glass">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: item.color }}>{fmt(item.value)}</p>
              {totalDespesas > 0 && (
                <div className="mt-2">
                  <Progress value={(item.value / totalDespesas) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((item.value / totalDespesas) * 100).toFixed(0)}% do total
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Últimas despesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTransactions.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.categories?.cor_hex ?? '#666' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.descricao || t.categories?.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.data + 'T00:00'), 'dd/MM', { locale: ptBR })} · {t.categories?.nome}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-destructive flex-shrink-0">{fmt(Number(t.valor))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Goals progress */}
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
                current = transactions
                  .filter((t) => t.category_id === goal.category_id)
                  .reduce((s, t) => s + Number(t.valor), 0);
              }
              const pct = Math.min((current / Number(goal.valor_alvo)) * 100, 100);
              const isOver = current > Number(goal.valor_alvo);
              const isLimit = goal.tipo_meta !== 'meta_renda_extra';

              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.nome_meta}</span>
                    <span className={isLimit && isOver ? 'text-destructive' : 'text-muted-foreground'}>
                      {fmt(current)} / {fmt(Number(goal.valor_alvo))}
                    </span>
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
