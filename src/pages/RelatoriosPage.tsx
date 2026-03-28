import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Download, FileText, BarChart3, PieChartIcon, TrendingUp, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { exportPdf } from '@/lib/exportPdf';
import { Progress } from '@/components/ui/progress';

export default function RelatoriosPage() {
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
        .select('*, categories(nome, cor_hex, grupo)')
        .gte('data', monthStart)
        .lte('data', monthEnd);
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

  // Totals
  const totalDespesas = transactions.reduce((s, t) => s + Number(t.valor), 0);
  const totalRendaExtra = extraIncome.reduce((s, t) => s + Number(t.valor), 0);
  const saldo = totalRendaExtra - totalDespesas;

  // Pie chart: by category
  const catMap = new Map<string, { nome: string; cor: string; total: number }>();
  transactions.forEach((t: any) => {
    const name = t.categories?.nome ?? 'Sem categoria';
    const existing = catMap.get(name);
    if (existing) existing.total += Number(t.valor);
    else catMap.set(name, { nome: name, cor: t.categories?.cor_hex ?? '#666', total: Number(t.valor) });
  });
  const pieData = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

  // Bar chart: by week
  const weekMap = new Map<string, number>();
  transactions.forEach((t) => {
    const d = new Date(t.data + 'T00:00');
    const weekNum = Math.ceil(d.getDate() / 7);
    const key = `Semana ${weekNum}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + Number(t.valor));
  });
  const barData = Array.from(weekMap.entries()).map(([semana, total]) => ({ semana, total }));

  // Group breakdown
  const groupData = [
    { label: 'Essenciais', value: transactions.filter((t: any) => t.categories?.grupo === 'essenciais').reduce((s, t) => s + Number(t.valor), 0), color: 'hsl(var(--primary))' },
    { label: 'Lazer', value: transactions.filter((t: any) => t.categories?.grupo === 'lazer').reduce((s, t) => s + Number(t.valor), 0), color: 'hsl(var(--warning))' },
    { label: 'Imprevistos', value: transactions.filter((t: any) => t.categories?.grupo === 'imprevistos').reduce((s, t) => s + Number(t.valor), 0), color: 'hsl(var(--destructive))' },
  ];

  // Extra income by origin
  const originMap = new Map<string, number>();
  extraIncome.forEach((r) => {
    originMap.set(r.origem, (originMap.get(r.origem) ?? 0) + Number(r.valor));
  });
  const originData = Array.from(originMap.entries())
    .map(([origem, total]) => ({ origem, total }))
    .sort((a, b) => b.total - a.total);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    const mesLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });
    exportPdf({
      title: 'MM Fluxo — Relatório Mensal',
      subtitle: `${activeProfile?.name ?? 'Perfil'} · ${mesLabel}`,
      sections: [
        {
          heading: 'Despesas',
          columns: ['Data', 'Hora', 'Categoria', 'Descrição', 'Valor', 'Status'],
          rows: transactions.map((t: any) => [
            t.data, t.hora, t.categories?.nome ?? '', t.descricao, fmt(Number(t.valor)), t.status,
          ]),
        },
        {
          heading: 'Renda Extra',
          columns: ['Data', 'Hora', 'Origem', 'Valor', 'Observação'],
          rows: extraIncome.map((r) => [
            r.data, r.hora, r.origem, fmt(Number(r.valor)), r.observacao ?? '',
          ]),
        },
      ],
      filename: `relatorio-${format(now, 'yyyy-MM')}.pdf`,
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-primary" />
            Relatórios
          </h2>
          <p className="text-muted-foreground text-sm capitalize">
            {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleExportPdf} className="bg-primary hover:bg-primary/90">
            <FileText size={14} className="mr-1.5" />PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCSV(transactions.map((t: any) => ({
            data: t.data, hora: t.hora, categoria: t.categories?.nome, descricao: t.descricao, valor: t.valor, status: t.status,
          })), 'despesas.csv')}>
            <Download size={14} className="mr-1.5" />Despesas
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCSV(extraIncome.map((r) => ({
            data: r.data, hora: r.hora, origem: r.origem, valor: r.valor, observacao: r.observacao ?? '',
          })), 'renda-extra.csv')}>
            <Download size={14} className="mr-1.5" />Renda Extra
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="card-glass overflow-hidden animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-destructive" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <ArrowDownCircle className="text-destructive" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Despesas</p>
                <p className="text-lg font-bold text-destructive">{fmt(totalDespesas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-accent" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/10">
                <ArrowUpCircle className="text-accent" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Renda Extra</p>
                <p className="text-lg font-bold text-accent">{fmt(totalRendaExtra)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass overflow-hidden animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <CardContent className="pt-5 pb-4 relative">
            <div className={`absolute top-0 left-0 w-full h-0.5 ${saldo >= 0 ? 'bg-accent' : 'bg-destructive'}`} />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Wallet className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo</p>
                <p className={`text-lg font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(saldo)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon size={14} /> Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
            ) : (
              <div className="h-72">
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
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                      label={renderCustomLabel}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{
                        backgroundColor: 'hsl(216 30% 8%)',
                        border: '1px solid hsl(216 20% 20%)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={14} /> Despesas por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={32}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210 85% 50%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(210 85% 35%)" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 20% 12%)" vertical={false} />
                    <XAxis dataKey="semana" tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(232 10% 59%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), 'Total']}
                      contentStyle={{
                        backgroundColor: 'hsl(216 30% 8%)',
                        border: '1px solid hsl(216 20% 20%)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      }}
                    />
                    <Bar dataKey="total" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group breakdown + Extra income */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Group breakdown */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={14} /> Distribuição por Grupo
            </CardTitle>
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
                <p className="text-xs text-muted-foreground text-right">
                  {totalDespesas > 0 ? ((g.value / totalDespesas) * 100).toFixed(1) : 0}% do total
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Extra income by origin */}
        <Card className="card-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowUpCircle size={14} /> Renda Extra por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {originData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">Sem dados no período</p>
            ) : (
              <div className="space-y-3">
                {originData.map(({ origem, total }, i) => (
                  <div key={origem} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-accent/5 border border-accent/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                        {i + 1}
                      </div>
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
    </div>
  );
}
