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
        <h2 className="text-xl font-semibold tracking-tight">Resumo Financeiro</h2>
        <MonthSelector />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
        <Card className="card-glass border-none">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Renda Extra</p>
            <p className="text-xl font-bold text-accent">{fmt(totalRendaExtra)}</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Gastos do Mês</p>
            <p className="text-xl font-bold text-destructive">{fmt(totalGastos)}</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Disponível</p>
            <p className={`text-xl font-bold ${restante < 0 ? 'text-destructive' : 'text-accent'}`}>{fmt(restante)}</p>
          </CardContent>
        </Card>

        <Card className="card-glass border-none">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Saldo Líquido</p>
            <p className={`text-xl font-bold ${saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(saldo)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 animate-fade-up">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos Lançamentos</h3>
        </div>
        
        <div className="grid gap-3">
          {ultimosGastos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">Nenhum gasto recente.</p>
          ) : (
            ultimosGastos.map((item) => (
              <Card key={item.id} className="card-glass border-none overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${TIPO_DOT_CLASSES[item.tipo_despesa] ?? 'bg-muted'}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa]}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(`${item.data}T00:00`), 'dd/MM', { locale: ptBR })} · {TIPO_LABELS[item.tipo_despesa]}
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
  );
}
