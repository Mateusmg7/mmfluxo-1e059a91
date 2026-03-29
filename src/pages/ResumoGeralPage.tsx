import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

const TIPO_LABELS: Record<string, string> = { essencial: 'Essenciais', lazer: 'Lazer', imprevisto: 'Imprevistos', besteira: 'Besteiras' };
const TIPO_COLORS: Record<string, string> = { essencial: '#0C5BA8', lazer: '#8B5CF6', imprevisto: '#EAB308', besteira: '#F97316' };

export default function ResumoGeralPage() {
  const { user } = useAuth();
  const { profiles } = useProfile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all_transactions', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase.from('transactions').select('*, categories(nome, cor_hex)').gte('data', monthStart).lte('data', monthEnd);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: allExtraIncome = [] } = useQuery({
    queryKey: ['all_extra_income', monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase.from('extra_income').select('*').gte('data', monthStart).lte('data', monthEnd);
      return data ?? [];
    },
    enabled: !!user,
  });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const totalDespesas = allTransactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = allExtraIncome.reduce((s, t) => s + Number(t.valor), 0);
  

  const profileData = profiles.map((p) => {
    const despesas = allTransactions.filter((t) => t.profile_id === p.id).reduce((s, t) => s + Number(t.valor), 0);
    const renda = allExtraIncome.filter((t) => t.profile_id === p.id).reduce((s, t) => s + Number(t.valor), 0);
    return { ...p, despesas, renda };
  });

  const barData = profileData.map((p) => ({ name: `${p.icon} ${p.name}`, Despesas: p.despesas, 'Renda Extra': p.renda }));

  // Group by tipo_despesa
  const tipoTotals = allTransactions.reduce((acc: Record<string, number>, t: any) => {
    const tipo = t.tipo_despesa ?? 'essencial';
    acc[tipo] = (acc[tipo] ?? 0) + Number(t.valor);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Layers size={24} className="text-primary" />Resumo Geral</h2>
        <div className="flex items-center gap-2 mt-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft size={16} /></Button>
          <span className="text-sm text-muted-foreground capitalize min-w-[140px] text-center">{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight size={16} /></Button>
          {format(currentMonth, 'yyyy-MM') !== format(new Date(), 'yyyy-MM') && (
            <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setCurrentMonth(new Date())}>Mês atual</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Despesas Totais', value: totalDespesas, cls: 'text-destructive', Icon: ArrowDownCircle, bg: 'bg-destructive/10' },
          { label: 'Renda Extra Total', value: totalRendaExtra, cls: 'text-accent', Icon: ArrowUpCircle, bg: 'bg-accent/10' },
        ].map((c, i) => (
          <Card key={c.label} className="card-glass animate-fade-up" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${c.bg}`}><c.Icon className={c.cls} size={20} /></div>
                <div><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.cls}`}>{fmt(c.value)}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {barData.length > 1 && (
        <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Comparativo por Perfil</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
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
        {profileData.map((p, index) => (
          <Card key={p.id} className="card-glass border-l-4 animate-fade-up" style={{ borderLeftColor: p.color, animationDelay: `${0.25 + index * 0.05}s` }}>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><span className="text-lg">{p.icon}</span> {p.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Despesas</span><span className="text-destructive font-medium">{fmt(p.despesas)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Renda Extra</span><span className="text-accent font-medium">{fmt(p.renda)}</span></div>
              
              {totalDespesas > 0 && p.despesas > 0 && (
                <div>
                  <Progress value={(p.despesas / totalDespesas) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{((p.despesas / totalDespesas) * 100).toFixed(0)}% das despesas totais</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-glass animate-scale-up" style={{ animationDelay: '0.35s' }}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribuição consolidada por tipo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(TIPO_LABELS).map(([key, label]) => {
              const value = tipoTotals[key] ?? 0;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[key] }} />
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: TIPO_COLORS[key] }}>{fmt(value)}</p>
                  {totalDespesas > 0 && (
                    <>
                      <Progress value={(value / totalDespesas) * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{((value / totalDespesas) * 100).toFixed(0)}% do total</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
