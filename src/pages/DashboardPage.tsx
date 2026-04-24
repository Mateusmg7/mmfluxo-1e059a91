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
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-primary h-6 w-6" />
          <h2 className="text-2xl font-bold tracking-tight">Painel Principal</h2>
        </div>
        <MonthSelector />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 animate-fade-up">
        {/* Card de Saldo Mensal */}
        <Card className="card-glass overflow-hidden relative border-none">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Wallet size={80} />
          </div>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Saldo do Mês</p>
            <h3 className={`text-3xl font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>
              {fmt(saldo)}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-accent">
                <TrendingUp size={12} /> {fmt(totalRendaExtra)}
              </span>
              <span className="text-muted-foreground">vs</span>
              <span className="flex items-center gap-1 text-destructive">
                <TrendingDown size={12} /> {fmt(totalGastos)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card de Orçamento */}
        {orcamento > 0 && (
          <Card className="card-glass border-none md:col-span-2 lg:col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Limite de Gastos</p>
                  <p className="text-2xl font-bold">{fmt(orcamento)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Disponível</p>
                  <p className={`text-2xl font-bold ${restante < 0 ? 'text-destructive' : 'text-accent'}`}>
                    {fmt(restante)}
                  </p>
                </div>
              </div>
              <Progress value={percentualUsado} className={`h-3 ${percentualUsado > 90 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`} />
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Você já utilizou {percentualUsado.toFixed(1)}% do seu limite definido.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna da Esquerda: Evolução */}
        <div className="lg:col-span-2 space-y-6">
          <MonthlyEvolutionChart userId={user?.id || ''} profileId={activeProfile?.id} currentMonth={currentMonth} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="card-glass border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-destructive/10 p-3">
                    <ArrowDownCircle className="text-destructive" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Gastos</p>
                    <p className="text-xl font-bold text-destructive">{fmt(totalGastos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent/10 p-3">
                    <ArrowUpCircle className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Renda Extra</p>
                    <p className="text-xl font-bold text-accent">{fmt(totalRendaExtra)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Coluna da Direita: Últimos Gastos */}
        <Card className="card-glass border-none h-fit">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Atividades Recentes</CardTitle>
            <Wallet size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ultimosGastos.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground italic">Nenhuma atividade registrada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ultimosGastos.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 group">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`h-2 w-2 flex-shrink-0 rounded-full ${TIPO_DOT_CLASSES[item.tipo_despesa] ?? 'bg-muted'}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                          {item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa]}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {format(new Date(`${item.data}T00:00`), 'dd MMM', { locale: ptBR })} · {TIPO_LABELS[item.tipo_despesa] ?? 'Essencial'}
                        </p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold text-destructive">-{fmt(Number(item.valor))}</span>
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
