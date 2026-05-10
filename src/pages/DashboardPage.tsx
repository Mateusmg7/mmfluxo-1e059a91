import { MonthSelector } from '@/components/layout/MonthSelector';
import { fetchTransactionsByPeriod } from '@/services/transactionsService';
import { fetchExtraIncomeByPeriod } from '@/services/extraIncomeService';
import { fetchRecurringExpenses } from '@/services/recurringExpensesService';
import { fetchMonthlyBudget, upsertMonthlyBudget } from '@/services/budgetService';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown, LayoutDashboard, Repeat, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';
// MonthlyComparisonChart removido daqui e mantido apenas em Relatórios

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
  const qc = useQueryClient();
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const now = new Date();

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthKey = format(startOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: monthlyBudgetData } = useQuery({
    queryKey: qk.monthlyBudget.byProfileAndMonth(activeProfile?.id, monthKey),
    queryFn: () => fetchMonthlyBudget(activeProfile?.id, currentMonth),
    enabled: !!activeProfile,
  });

  const updateBudgetMutation = useMutation({
    mutationFn: (amount: number) => upsertMonthlyBudget(activeProfile!.id, currentMonth, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.monthlyBudget.byProfileAndMonth(activeProfile?.id, monthKey) });
      setIsBudgetDialogOpen(false);
      toast.success('Orçamento atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar orçamento: ' + error.message);
    }
  });

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

  const { data: recurringRules = [] } = useQuery({
    queryKey: qk.recurringExpenses.byProfile(activeProfile?.id),
    queryFn: () => fetchRecurringExpenses(activeProfile?.id),
    enabled: !!user && !!activeProfile,
  });

  // Filtramos apenas as transações que NÃO são recorrentes para evitar duplicidade
  const manualTransactions = transactions.filter(t => !t.recorrente);
  const totalGastosManuais = manualTransactions.reduce((sum, item) => sum + Number(item.valor), 0);
  const totalGastosRecorrentes = recurringRules
    .filter(r => r.ativo)
    .reduce((sum, item) => sum + Number(item.valor), 0);

  const totalGastos = totalGastosManuais + totalGastosRecorrentes;
  const totalRendaExtra = extraIncome.reduce((sum, item) => sum + Number(item.valor), 0);
  
  // Usar orçamento mensal histórico se existir, senão usar o do perfil (fallback)
  const orcamento = monthlyBudgetData ? Number(monthlyBudgetData.amount) : Number(activeProfile?.orcamento_mensal ?? 0);
  
  const saldo = totalRendaExtra - totalGastos;
  const restante = orcamento - totalGastos;
  const percentualUsado = orcamento > 0 ? Math.min((totalGastos / orcamento) * 100, 100) : 0;

  useEffect(() => {
    if (monthlyBudgetData) {
      setBudgetAmount(monthlyBudgetData.amount.toString());
    } else if (activeProfile?.orcamento_mensal) {
      setBudgetAmount(activeProfile.orcamento_mensal.toString());
    }
  }, [monthlyBudgetData, activeProfile]);

  const handleSaveBudget = () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount)) {
      toast.error('Informe um valor válido');
      return;
    }
    updateBudgetMutation.mutate(amount);
  };
  
  const combinedActivities = [
    ...manualTransactions.map(t => ({ ...t, activityType: 'expense' })),
    ...recurringRules.filter(r => r.ativo).map(r => ({ 
      ...r, 
      id: `rec-${r.id}`, 
      data: format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), r.dia_vencimento), 'yyyy-MM-dd'),
      activityType: 'expense',
      isRecurringRule: true 
    })),
    ...extraIncome.map(i => ({ ...i, activityType: 'income' }))
  ].sort((a, b) => {
    const dateA = new Date(`${a.data}T00:00`).getTime();
    const dateB = new Date(`${b.data}T00:00`).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
        <Card 
          className="card-glass border-none overflow-hidden relative group hover:shadow-lg transition-all duration-300 cursor-pointer"
          onClick={() => setIsBudgetDialogOpen(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Orçamento Mensal</p>
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            
            {orcamento > 0 ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">Sem orçamento definido</p>
                <Button size="sm" variant="outline" className="w-full">
                  <Plus size={14} className="mr-1" /> Definir Orçamento
                </Button>
              </div>
            )}
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
          {/* Gráfico de análise comparativa removido daqui e mantido apenas em Relatórios */}
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
                            ? (item.nome || item.motivo || item.categories?.nome || TIPO_LABELS[item.tipo_despesa])
                            : (item.origem || 'Renda Extra')
                          }
                          {item.isRecurringRule && (
                            <span className="ml-2 inline-flex items-center">
                              <Repeat size={10} className="text-primary" />
                            </span>
                          )}
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

      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Definir Orçamento para {format(currentMonth, 'MMMM/yyyy', { locale: ptBR })}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor do Orçamento</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0,00"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBudget} disabled={updateBudgetMutation.isPending}>
              {updateBudgetMutation.isPending ? 'Salvando...' : 'Salvar Orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
