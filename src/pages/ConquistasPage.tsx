import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileRanking {
  id: string;
  name: string;
  icon: string;
  color: string;
  totalDespesas: number;
  totalRenda: number;
  economia: number;
}

export default function ConquistasPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const mesInicio = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const mesFim = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  const mesLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  const isCurrentMonth = format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['ranking', user?.id, mesInicio],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('financial_profiles').select('id, name, icon, color').eq('user_id', user!.id);
      if (!profiles || profiles.length === 0) return [];
      const { data: transactions } = await supabase.from('transactions').select('profile_id, valor').eq('user_id', user!.id).gte('data', mesInicio).lte('data', mesFim);
      const { data: income } = await supabase.from('extra_income').select('profile_id, valor').eq('user_id', user!.id).gte('data', mesInicio).lte('data', mesFim);
      const result: ProfileRanking[] = profiles.map((p) => {
        const totalDespesas = (transactions ?? []).filter((t) => t.profile_id === p.id).reduce((sum, t) => sum + Number(t.valor), 0);
        const totalRenda = (income ?? []).filter((i) => i.profile_id === p.id).reduce((sum, i) => sum + Number(i.valor), 0);
        return { id: p.id, name: p.name, icon: p.icon, color: p.color, totalDespesas, totalRenda, economia: totalRenda - totalDespesas };
      });
      return result.sort((a, b) => b.economia - a.economia);
    },
    enabled: !!user,
  });

  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];
  const maxDespesa = Math.max(...ranking.map(r => r.totalDespesas), 1);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold">Ranking Mensal</h2>
        <p className="text-muted-foreground text-sm">Compare a economia entre seus perfis financeiros</p>
      </div>

      <div className="flex items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft size={18} />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[160px] text-center">{mesLabel}</span>
        {!isCurrentMonth && (
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight size={18} />
          </Button>
        )}
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-1">
            <Calendar size={14} className="mr-1" /> Hoje
          </Button>
        )}
        {isCurrentMonth && <div className="w-9" />}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando ranking...</div>
      ) : ranking.length < 2 ? (
        <Card className="card-glass animate-fade-up">
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">Crie pelo menos <strong>2 perfis financeiros</strong> para ver o ranking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {ranking.map((profile, index) => {
            const barWidth = maxDespesa > 0 ? (profile.totalDespesas / maxDespesa) * 100 : 0;
            return (
              <Card key={profile.id} className={cn('card-glass transition-all hover:scale-[1.01]', index === 0 && 'ring-1 ring-yellow-400/30')}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center min-w-[40px]">
                      {index < 3 ? <Trophy className={cn('mb-0.5', medalColors[index])} size={22} /> : <span className="text-lg font-bold text-muted-foreground">{index + 1}º</span>}
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: profile.color + '22', borderColor: profile.color, borderWidth: 2 }}>
                      {profile.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm truncate">{profile.name}</p>
                        <span className={cn('text-sm font-bold', profile.economia >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                          {profile.economia >= 0 ? '+' : ''}R$ {Math.abs(profile.economia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: profile.color, opacity: 0.7 }} />
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500" />R$ {profile.totalRenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="flex items-center gap-1"><TrendingDown size={12} className="text-destructive" />R$ {profile.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {ranking.length >= 2 && (
        <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumo do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Renda</p>
                <p className="text-sm font-bold text-emerald-500">R$ {ranking.reduce((s, r) => s + r.totalRenda, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Despesas</p>
                <p className="text-sm font-bold text-destructive">R$ {ranking.reduce((s, r) => s + r.totalDespesas, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Economia Total</p>
                <p className={cn('text-sm font-bold', ranking.reduce((s, r) => s + r.economia, 0) >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                  R$ {Math.abs(ranking.reduce((s, r) => s + r.economia, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
