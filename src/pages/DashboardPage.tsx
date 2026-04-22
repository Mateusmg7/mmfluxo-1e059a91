import { useState } from 'react';
import { fetchTransactionsByPeriod } from '@/services/transactionsService';
import { fetchExtraIncomeByPeriod } from '@/services/extraIncomeService';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  essencial: 'Essencial',
  lazer: 'Lazer',
  imprevisto: 'Imprevisto',
  besteira: 'Besteira',
};

const TIPO_DOT_CLASSES: Record<string, string> = {
  essencial: 'bg-primary',
  lazer: 'bg-info',
  imprevisto: 'bg-warning',
  besteira: 'bg-destructive',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(currentMonth, now);

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
  const restante = orcamento - totalGastos;
  const percentualUsado = orcamento > 0 ? Math.min((totalGastos / orcamento) * 100, 100) : 0;
  const ultimosGastos = transactions.slice(0, 5);

  const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground text-sm capitalize">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))} className="h-8 w-8">
            <ChevronLeft size={18} />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 px-2 text-xs">
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))} className="h-8 w-8">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {orcamento > 0 && (
        <Card className="card-glass border-l-4 border-l-primary animate-fade-up">
          <CardContent className="pt-5 pb-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-primary" />
                <span className="text-sm font-semibold">Orçamento do mês</span>
              </div>
              <span className="text-xs text-muted-foreground">{percentualUsado.toFixed(0)}% usado</span>
            </div>
            <Progress value={percentualUsado} className="h-2.5" />
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className={restante < 0 ? 'font-bold text-destructive' : 'font-bold text-accent'}>
                {restante < 0 ? `Passou ${fmt(Math.abs(restante))}` : `Restam ${fmt(restante)}`}
              </span>
              <span className="text-muted-foreground">{fmt(totalGastos)} / {fmt(orcamento)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4 animate-fade-up">
        <Card className="card-glass">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-destructive/10 p-2.5"><ArrowDownCircle className="text-destructive" size={20} /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gastos do mês</p>
                <p className="text-lg font-bold text-destructive">{fmt(totalGastos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5"><ArrowUpCircle className="text-accent" size={20} /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Renda extra</p>
                <p className="text-lg font-bold text-accent">{fmt(totalRendaExtra)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5"><Wallet className="text-primary" size={20} /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orçamento</p>
                <p className="text-lg font-bold">{orcamento > 0 ? fmt(orcamento) : 'Não definido'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-glass animate-fade-up">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {ultimosGastos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum gasto lançado neste mês</p>
          ) : (
            ultimosGastos.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${TIPO_DOT_CLASSES[item.tipo_despesa] ?? 'bg-muted'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa]}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(`${item.data}T00:00`), 'dd/MM', { locale: ptBR })} · {TIPO_LABELS[item.tipo_despesa] ?? 'Essencial'}
                    </p>
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-destructive">{fmt(Number(item.valor))}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
