import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Filter, Check } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  userId: string;
  profileId: string | undefined;
  currentMonth: Date;
}

export function MonthlyComparisonChart({ userId, profileId, currentMonth }: Props) {
  const prevMonth = subMonths(currentMonth, 1);

  const curStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const curEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

  const curLabel = format(currentMonth, 'MMM', { locale: ptBR });
  const prevLabel = format(prevMonth, 'MMM', { locale: ptBR });

  const { data: curTx = [] } = useQuery({
    queryKey: qk.comparison.current(profileId, curStart, curEnd),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('valor, categories(nome)')
        .gte('data', curStart)
        .lte('data', curEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  const { data: prevTx = [] } = useQuery({
    queryKey: qk.comparison.previous(profileId, prevStart, prevEnd),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('valor, categories(nome)')
        .gte('data', prevStart)
        .lte('data', prevEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  // Aggregate by category
  const aggregate = (txs: any[]) => {
    const map = new Map<string, number>();
    txs.forEach((t) => {
      const cat = t.categories?.nome ?? 'Outros';
      map.set(cat, (map.get(cat) ?? 0) + Number(t.valor));
    });
    return map;
  };

  const curMap = aggregate(curTx);
  const prevMap = aggregate(prevTx);

  const allCategories = new Set([...curMap.keys(), ...prevMap.keys()]);
  const chartData = Array.from(allCategories)
    .map((cat) => ({
      categoria: cat,
      atual: curMap.get(cat) ?? 0,
      anterior: prevMap.get(cat) ?? 0,
    }))
    .sort((a, b) => (b.atual + b.anterior) - (a.atual + a.anterior));

  const hasData = chartData.some((d) => d.atual > 0 || d.anterior > 0);

  const totalCur = chartData.reduce((s, d) => s + d.atual, 0);
  const totalPrev = chartData.reduce((s, d) => s + d.anterior, 0);
  const diffPct = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : 0;

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Find categories with biggest increase
  const variations = chartData
    .map((d) => ({
      cat: d.categoria,
      diff: d.atual - d.anterior,
      pct: d.anterior > 0 ? ((d.atual - d.anterior) / d.anterior) * 100 : d.atual > 0 ? 100 : 0,
    }))
    .filter((v) => Math.abs(v.diff) > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);

  return (
    <Card className="card-glass border-none shadow-lg animate-scale-up" style={{ animationDelay: '0.25s' }}>
      <CardHeader className="pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Análise Comparativa
            </CardTitle>
            {hasData && (
              <p className="text-xs text-muted-foreground mt-1">
                Comparação detalhada de gastos: <span className="font-semibold text-foreground">{format(currentMonth, 'MMMM', { locale: ptBR })}</span> vs {format(prevMonth, 'MMMM', { locale: ptBR })}
              </p>
            )}
          </div>
          {hasData && totalPrev > 0 && (
            <div className={`flex flex-col items-end`}>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${diffPct > 0 ? 'bg-destructive/10 text-destructive' : diffPct < 0 ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                {diffPct > 0 ? <TrendingUp size={14} /> : diffPct < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter font-medium">Variação Total</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Sem dados para comparar
          </p>
        ) : (
          <>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} opacity={0.4} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="categoria"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    formatter={(v: number, name: string) => [fmt(v), name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      color: 'hsl(var(--card-foreground))',
                      fontSize: '13px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                      padding: '10px'
                    }}
                    itemStyle={{ padding: '2px 0' }}
                    labelStyle={{ marginBottom: '5px', fontWeight: 700, color: 'hsl(var(--primary))' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 20 }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-muted-foreground ml-1">{value}</span>
                    )}
                  />
                  <Bar 
                    dataKey="anterior" 
                    name={`Gasto em ${prevLabel}`} 
                    fill="hsl(var(--muted-foreground))" 
                    radius={[0, 4, 4, 0]} 
                    opacity={0.3} 
                    barSize={20}
                  />
                  <Bar 
                    dataKey="atual" 
                    name={`Gasto em ${curLabel}`} 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]} 
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {variations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Maiores variações</p>
                {variations.map((v) => (
                  <div key={v.cat} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-muted/30">
                    <span className="font-medium">{v.cat}</span>
                    <div className={`flex items-center gap-1 font-semibold ${v.diff > 0 ? 'text-destructive' : 'text-accent'}`}>
                      {v.diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {v.diff > 0 ? '+' : ''}{fmt(v.diff)}
                      {v.pct !== 100 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({v.diff > 0 ? '+' : ''}{v.pct.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
