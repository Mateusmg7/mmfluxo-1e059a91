import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';

export default function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(nome, grupo, cor_hex)')
        .gte('data', monthStart)
        .lte('data', monthEnd)
        .order('data', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: extraIncome = [] } = useQuery({
    queryKey: ['extra_income', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_income')
        .select('*')
        .gte('data', monthStart)
        .lte('data', monthEnd);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await supabase.from('goals').select('*, categories(nome)');
      return data ?? [];
    },
    enabled: !!user,
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

  // Chart data: expenses per day
  const days = eachDayOfInterval({ start: startOfMonth(now), end: now });
  const chartData = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const total = transactions
      .filter((t) => t.data === dayStr)
      .reduce((s, t) => s + Number(t.valor), 0);
    return { dia: format(day, 'dd'), total };
  });

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Despesas</p>
                <p className="text-2xl font-bold text-destructive">{fmt(totalDespesas)}</p>
              </div>
              <ArrowDownCircle className="text-destructive" size={28} />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Renda Extra</p>
                <p className="text-2xl font-bold text-accent">{fmt(totalRendaExtra)}</p>
              </div>
              <ArrowUpCircle className="text-accent" size={28} />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {fmt(saldo)}
                </p>
              </div>
              <Wallet className="text-primary" size={28} />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metas ativas</p>
                <p className="text-2xl font-bold">{goals.length}</p>
              </div>
              <TrendingUp className="text-cyan" size={28} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Essenciais', value: essenciais, color: 'text-primary' },
          { label: 'Lazer', value: lazer, color: 'text-warning' },
          { label: 'Imprevistos', value: imprevistos, color: 'text-destructive' },
        ].map((item) => (
          <Card key={item.label} className="card-glass">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{fmt(item.value)}</p>
              {totalDespesas > 0 && (
                <div className="mt-2">
                  <Progress
                    value={(item.value / totalDespesas) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((item.value / totalDespesas) * 100).toFixed(0)}% do total
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily chart */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-base">Despesas por dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 20% 16%)" />
                <XAxis dataKey="dia" tick={{ fill: '#8E91A1', fontSize: 12 }} />
                <YAxis tick={{ fill: '#8E91A1', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(216 30% 8%)',
                    border: '1px solid hsl(216 20% 16%)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [fmt(value), 'Total']}
                />
                <Bar dataKey="total" fill="#0C5BA8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Goals progress */}
      {goals.length > 0 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-base">Progresso das Metas</CardTitle>
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
