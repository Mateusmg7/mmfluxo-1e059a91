import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export default function ResumoGeralPage() {
  const { user } = useAuth();
  const { profiles } = useProfile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  // Fetch ALL transactions (no profile filter)
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all_transactions', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(nome, grupo, cor_hex)')
        .gte('data', monthStart)
        .lte('data', monthEnd);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: allExtraIncome = [] } = useQuery({
    queryKey: ['all_extra_income', monthStart, monthEnd],
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

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalDespesas = allTransactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = allExtraIncome.reduce((s, t) => s + Number(t.valor), 0);
  const saldo = totalRendaExtra - totalDespesas;

  // Per-profile breakdown
  const profileData = profiles.map((p) => {
    const despesas = allTransactions
      .filter((t) => t.profile_id === p.id)
      .reduce((s, t) => s + Number(t.valor), 0);
    const renda = allExtraIncome
      .filter((t) => t.profile_id === p.id)
      .reduce((s, t) => s + Number(t.valor), 0);
    return { ...p, despesas, renda, saldo: renda - despesas };
  });

  // Bar chart data
  const barData = profileData.map((p) => ({
    name: `${p.icon} ${p.name}`,
    Despesas: p.despesas,
    'Renda Extra': p.renda,
    color: p.color,
  }));

  // Group breakdown across all profiles
  const essenciais = allTransactions
    .filter((t: any) => t.categories?.grupo === 'essenciais')
    .reduce((s, t) => s + Number(t.valor), 0);
  const lazer = allTransactions
    .filter((t: any) => t.categories?.grupo === 'lazer')
    .reduce((s, t) => s + Number(t.valor), 0);
  const imprevistos = allTransactions
    .filter((t: any) => t.categories?.grupo === 'imprevistos')
    .reduce((s, t) => s + Number(t.valor), 0);
  const besteirasVal = allTransactions
    .filter((t: any) => t.categories?.grupo === 'besteiras')
    .reduce((s, t) => s + Number(t.valor), 0);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Layers size={24} className="text-primary" />
          Resumo Geral
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-muted-foreground capitalize min-w-[140px] text-center">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight size={16} />
          </Button>
          {format(currentMonth, 'yyyy-MM') !== format(new Date(), 'yyyy-MM') && (
            <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setCurrentMonth(new Date())}>
              Mês atual
            </Button>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ArrowDownCircle className="text-destructive" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas Totais</p>
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
                <p className="text-xs text-muted-foreground">Renda Extra Total</p>
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
                <p className="text-xs text-muted-foreground">Saldo Geral</p>
                <p className={`text-lg font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {fmt(saldo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart comparison */}
      {barData.length > 1 && (
        <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Comparativo por Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <XAxis dataKey="name" tick={{ fill: 'hsl(232 10% 59%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
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
                  <Bar dataKey="Despesas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Renda Extra" fill="hsl(147 78% 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-profile cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profileData.map((p, index) => (
          <Card key={p.id} className="card-glass border-l-4 animate-fade-up" style={{ borderLeftColor: p.color, animationDelay: `${0.25 + index * 0.05}s` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="text-lg">{p.icon}</span> {p.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Despesas</span>
                <span className="text-destructive font-medium">{fmt(p.despesas)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Renda Extra</span>
                <span className="text-accent font-medium">{fmt(p.renda)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span>Saldo</span>
                <span className={p.saldo >= 0 ? 'text-accent' : 'text-destructive'}>{fmt(p.saldo)}</span>
              </div>
              {totalDespesas > 0 && p.despesas > 0 && (
                <div>
                  <Progress value={(p.despesas / totalDespesas) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((p.despesas / totalDespesas) * 100).toFixed(0)}% das despesas totais
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Group breakdown */}
      <Card className="card-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Distribuição consolidada por grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Essenciais', value: essenciais, color: '#0C5BA8' },
              { label: 'Lazer', value: lazer, color: '#F97316' },
              { label: 'Imprevistos', value: imprevistos, color: '#EF4444' },
              { label: 'Besteiras', value: besteirasVal, color: '#A855F7' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: item.color }}>{fmt(item.value)}</p>
                {totalDespesas > 0 && (
                  <>
                    <Progress value={(item.value / totalDespesas) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {((item.value / totalDespesas) * 100).toFixed(0)}% do total
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
