import { MonthSelector } from '@/components/layout/MonthSelector';
import { fetchTransactionsByPeriod } from '@/services/transactionsService';
import { fetchExtraIncomeByPeriod } from '@/services/extraIncomeService';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown, LayoutDashboard } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';
import { MonthlyComparisonChart } from '@/components/charts/MonthlyComparisonChart';

const TIPO_LABELS: Record<string, string> = {
  essencial: 'Essencial',
  lazer: 'Lazer',
  imprevisto: 'Imprevisto',
  besteira: 'Besteira',
};

const TIPO_DOT_CLASSES: Record<string, string> = {
  essencial: 'bg-primary',
  lazer: 'bg-secondary',
  imprevisto: 'bg-warning',
  besteira: 'bg-destructive',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeProfile, currentMonth } = useProfile();
  const now = new Date();

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: transactions = [] } = useQuery({
    queryKey: qk.transactions.byPeriod(activeProfile?.id, monthStart, monthEnd),
    queryFn: () => fetchTransactionsByPeriod({ profileId: activeProfile?.id, startDate: monthStart, endDate: monthEnd, withHourOrder: true }),
    enabled: !!user && !!activeProfile,
  });

  const { data: extraIncome = [] } = useQuery({
    queryKey: qk.extraIncome.byPeriod(activeProfile?.id, monthStart, monthEnd),
    queryFn: () => fetchExtraIncomeByPeriod({ profileId: activeProfile?.id, startDate: monthStart, endDate: monthEnd }),
    enabled: !!user && !!activeProfile,
  });

  const totalGastos = transactions.reduce((sum, item) => sum + Number(item.valor), 0);
  const totalRendaExtra = extraIncome.reduce((sum, item) => sum + Number(item.valor), 0);
  const orcamento = Number(activeProfile?.orcamento_mensal ?? 0);
  const saldo = totalRendaExtra - totalGastos;
  const restante = orcamento - totalGastos;
  const percentualUsado = orcamento > 0 ? Math.min((totalGastos / orcamento) * 100, 100) : 0;
  const combinedActivities = [
    ...transactions.map(t => ({ ...t, activityType: 'expense' })),
    ...extraIncome.map(i => ({ ...i, activityType: 'income' }))
  ].sort((a, b) => {
    const dateA = new Date(`${a.data}T00:00`).getTime();
    const dateB = new Date(`${b.data}T00:00`).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const ultimasAtividades = combinedActivities.slice(0, 5);

  const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta, aqui está seu resumo.</p>
        </div>
        <MonthSelector />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
        <Card className="card-glass border-none overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Orçamento Mensal</p>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{fmt(orcamento)}</p>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Progresso do Uso</span>
                <span className={percentualUsado > 90 ? 'text-destructive' : 'text-primary'}>
                  {percentualUsado.toFixed(0)}%
                </span>
              </div>
              <Progress value={percentualUsado} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Gastos Totais</p>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
            </div>
            <p className="text-3xl font-bold text-destructive tracking-tight">{fmt(totalGastos)}</p>
            <p className="text-xs text-muted-foreground mt-2">Total acumulado no mês</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Renda Extra</p>
              <div className="p-2 bg-accent/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-accent tracking-tight">{fmt(totalRendaExtra)}</p>
            <p className="text-xs text-muted-foreground mt-2">Ganhos adicionais</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Saldo Final</p>
              <div className={`p-2 ${saldo >= 0 ? 'bg-accent/10' : 'bg-destructive/10'} rounded-lg`}>
                <div className={`h-2 w-2 rounded-full ${saldo >= 0 ? 'bg-accent' : 'bg-destructive'} animate-pulse`} />
              </div>
            </div>
            <p className={`text-3xl font-bold tracking-tight ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(saldo)}</p>
            <p className="text-xs text-muted-foreground mt-2">Resultado do período</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-up">
        <div className="lg:col-span-2 space-y-6">
          <MonthlyComparisonChart userId={user?.id} profileId={activeProfile?.id} currentMonth={currentMonth} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Atividades Recentes</h3>
          </div>
          
          <div className="grid gap-4">
            {ultimasAtividades.length === 0 ? (
              <div className="bg-muted/30 rounded-xl p-8 border border-dashed border-muted flex flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground italic font-medium">Nenhuma atividade recente.</p>
              </div>
            ) : (
              ultimasAtividades.map((item: any) => (
                <Card key={item.id} className="card-glass border-none overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-muted/50 ${item.activityType === 'expense' ? (TIPO_DOT_CLASSES[item.tipo_despesa] ?? 'bg-muted') : 'bg-accent'} bg-opacity-15 text-xs font-bold shadow-inner`}>
                        {item.activityType === 'expense' 
                          ? (TIPO_LABELS[item.tipo_despesa]?.charAt(0) || 'G')
                          : 'R'
                        }
                      </div>
                      <div>
                        <p className="text-sm font-semibold tracking-tight">
                          {item.activityType === 'expense' 
                            ? (item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa])
                            : (item.origem || 'Renda Extra')
                          }
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {format(new Date(`${item.data}T00:00`), 'dd/MM', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${item.activityType === 'expense' ? 'text-destructive' : 'text-accent'}`}>
                      {item.activityType === 'expense' ? '-' : '+'}{fmt(Number(item.valor))}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
