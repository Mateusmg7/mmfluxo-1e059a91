import { useState } from 'react';
import { useGamification } from '@/hooks/useGamification';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flame, Trophy, Star, Lock, ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
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
  const { unlockedBadges, lockedBadges, streak, level, xpProgress } = useGamification();
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
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold">Conquistas</h2>
        <p className="text-muted-foreground text-sm">Medalhas, sequências e ranking entre perfis</p>
      </div>

      <Tabs defaultValue="medalhas" className="animate-fade-up">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="medalhas">Medalhas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* ===== MEDALHAS ===== */}
        <TabsContent value="medalhas" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="card-glass">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10"><Star className="text-primary" size={20} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nível</p>
                    <p className="text-lg font-bold text-primary">{level}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress value={xpProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{unlockedBadges.length} medalhas — próx. nível: {(level) * 3}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-destructive/10"><Flame className="text-destructive" size={20} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sequência Atual</p>
                    <p className="text-lg font-bold text-destructive">{streak.current_streak} dias</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Dias seguidos sem besteiras</p>
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-accent/10"><Trophy className="text-accent" size={20} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recorde</p>
                    <p className="text-lg font-bold text-accent">{streak.best_streak} dias</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Melhor sequência</p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Medalhas Conquistadas ({unlockedBadges.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unlockedBadges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma medalha ainda. Continue usando o app para conquistar!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {unlockedBadges.map((badge: any) => (
                    <div key={badge.id} className="flex flex-col items-center text-center p-4 rounded-xl bg-primary/5 border border-primary/20 transition-all hover:scale-105">
                      <span className="text-3xl mb-2">{badge.icone}</span>
                      <p className="text-sm font-semibold">{badge.nome}</p>
                      <p className="text-xs text-muted-foreground mt-1">{badge.descricao}</p>
                      <Badge variant="secondary" className="mt-2 text-[10px]">
                        {format(new Date(badge.unlocked_at), "dd/MM/yy", { locale: ptBR })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                A Desbloquear ({lockedBadges.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lockedBadges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">🎉 Parabéns! Todas as medalhas foram conquistadas!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {lockedBadges.map((badge) => (
                    <div key={badge.id} className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/30 border border-border opacity-60 grayscale">
                      <div className="relative">
                        <span className="text-3xl mb-2 blur-[2px]">{badge.icone}</span>
                        <Lock className="absolute -bottom-1 -right-1 text-muted-foreground" size={14} />
                      </div>
                      <p className="text-sm font-semibold mt-2">{badge.nome}</p>
                      <p className="text-xs text-muted-foreground mt-1">{badge.descricao}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== RANKING ===== */}
        <TabsContent value="ranking" className="space-y-6">
          <div className="flex items-center justify-center gap-3">
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
            <Card className="card-glass">
              <CardContent className="py-12 text-center">
                <Trophy className="mx-auto mb-3 text-muted-foreground" size={40} />
                <p className="text-muted-foreground">Crie pelo menos <strong>2 perfis financeiros</strong> para ver o ranking.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
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
            <Card className="card-glass">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
