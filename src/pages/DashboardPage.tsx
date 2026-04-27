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
  const ultimosGastos = transactions.slice(0, 5);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
        <Card className="card-glass border-none overflow-hidden relative group">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Orcamento Mensal</p>
              <Wallet className="h-4 w-4 text-primary opacity-50" />
            </div>
            <p className="text-2xl font-bold">{fmt(orcamento)}</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>Progresso do Uso</span>
                <span>{percentualUsado.toFixed(0)}%</span>
              </div>
              <Progress value={percentualUsado} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gastos Totais</p>
              <TrendingDown className="h-4 w-4 text-destructive opacity-50" />
            </div>
            <p className="text-2xl font-bold text-destructive">{fmt(totalGastos)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Total acumulado no mês</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Renda Extra</p>
              <TrendingUp className="h-4 w-4 text-accent opacity-50" />
            </div>
            <p className="text-2xl font-bold text-accent">{fmt(totalRendaExtra)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Ganhos adicionais</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none group">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saldo Final</p>
              <div className={`h-2 w-2 rounded-full ${saldo >= 0 ? 'bg-accent' : 'bg-destructive'} animate-pulse`} />
            </div>
            <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(saldo)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Resultado do período</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up">
        <Card className="lg:col-span-2 card-glass border-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <MonthlyEvolutionChart />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Atividades Recentes</h3>
          </div>
          
          <div className="grid gap-3">
            {ultimosGastos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 px-1">Nenhum gasto recente.</p>
            ) : (
              ultimosGastos.map((item) => (
                <Card key={item.id} className="card-glass border-none overflow-hidden transition-all hover:translate-x-1">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center bg-muted/50 ${TIPO_DOT_CLASSES[item.tipo_despesa] ?? 'bg-muted'} bg-opacity-10 text-xs font-bold`}>
                        {TIPO_LABELS[item.tipo_despesa]?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(`${item.data}T00:00`), 'dd/MM', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-destructive">-{fmt(Number(item.valor))}</span>
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
