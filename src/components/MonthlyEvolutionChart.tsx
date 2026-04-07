import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface Props {
  userId: string;
  profileId: string | undefined;
  currentMonth: Date;
}

export function MonthlyEvolutionChart({ userId, profileId, currentMonth }: Props) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(currentMonth, 5 - i);
    return {
      date: m,
      label: format(m, 'MMM', { locale: ptBR }),
      start: format(startOfMonth(m), 'yyyy-MM-dd'),
      end: format(endOfMonth(m), 'yyyy-MM-dd'),
    };
  });

  const rangeStart = months[0].start;
  const rangeEnd = months[5].end;

  const { data: txData = [] } = useQuery({
    queryKey: ['evolution-tx', rangeStart, rangeEnd, profileId],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('data, valor')
        .gte('data', rangeStart)
        .lte('data', rangeEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  const { data: incomeData = [] } = useQuery({
    queryKey: ['evolution-income', rangeStart, rangeEnd, profileId],
    queryFn: async () => {
      let q = supabase
        .from('extra_income')
        .select('data, valor')
        .gte('data', rangeStart)
        .lte('data', rangeEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  const chartData = months.map((m) => {
    const despesas = txData
      .filter((t) => t.data >= m.start && t.data <= m.end)
      .reduce((s, t) => s + Number(t.valor), 0);
    const receitas = incomeData
      .filter((t) => t.data >= m.start && t.data <= m.end)
      .reduce((s, t) => s + Number(t.valor), 0);
    return { mes: m.label, Despesas: despesas, Receitas: receitas };
  });

  const hasData = chartData.some((d) => d.Despesas > 0 || d.Receitas > 0);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.2s' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Evolução Mensal (6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Sem dados nos últimos 6 meses
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                  width={55}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [fmt(v), name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    color: 'hsl(var(--card-foreground))',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                  itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                  labelStyle={{ color: 'hsl(var(--card-foreground))', fontWeight: 600 }}
                />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: 12 }}
                  formatter={(value) => (
                    <span className="text-xs text-foreground">{value}</span>
                  )}
                />
                <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Receitas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
