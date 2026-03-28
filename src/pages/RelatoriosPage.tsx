import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Download, FileText } from 'lucide-react';
import { exportPdf } from '@/lib/exportPdf';

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

  // Pie chart: by category
  const catMap = new Map<string, { nome: string; cor: string; total: number }>();
  transactions.forEach((t: any) => {
    const name = t.categories?.nome ?? 'Sem categoria';
    const existing = catMap.get(name);
    if (existing) existing.total += Number(t.valor);
    else catMap.set(name, { nome: name, cor: t.categories?.cor_hex ?? '#666', total: Number(t.valor) });
  });
  const pieData = Array.from(catMap.values());

  // Bar chart: by week
  const weekMap = new Map<string, number>();
  transactions.forEach((t) => {
    const d = new Date(t.data + 'T00:00');
    const weekNum = Math.ceil(d.getDate() / 7);
    const key = `Sem ${weekNum}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + Number(t.valor));
  });
  const barData = Array.from(weekMap.entries()).map(([semana, total]) => ({ semana, total }));

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <p className="text-muted-foreground text-sm">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: 'hsl(216 30% 8%)', border: '1px solid hsl(216 20% 16%)', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-base">Despesas por semana</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 20% 16%)" />
                    <XAxis dataKey="semana" tick={{ fill: '#8E91A1', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#8E91A1', fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Total']} contentStyle={{ backgroundColor: 'hsl(216 30% 8%)', border: '1px solid hsl(216 20% 16%)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="total" fill="#0C5BA8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extra income by origin */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-base">Renda Extra por origem</CardTitle>
        </CardHeader>
        <CardContent>
          {originData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {originData.map(({ origem, total }) => (
                <div key={origem} className="flex justify-between py-2 border-b border-border last:border-0">
                  <span>{origem}</span>
                  <span className="font-semibold text-accent">{fmt(total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => exportCSV(transactions.map((t: any) => ({
          data: t.data, hora: t.hora, categoria: t.categories?.nome, descricao: t.descricao, valor: t.valor, status: t.status,
        })), 'despesas.csv')}>
          <Download size={16} className="mr-2" />Exportar despesas CSV
        </Button>
        <Button variant="secondary" onClick={() => exportCSV(extraIncome.map((r) => ({
          data: r.data, hora: r.hora, origem: r.origem, valor: r.valor, observacao: r.observacao ?? '',
        })), 'renda-extra.csv')}>
          <Download size={16} className="mr-2" />Exportar renda extra CSV
        </Button>
      </div>
    </div>
  );
}
