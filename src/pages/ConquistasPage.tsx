import { useGamification } from '@/hooks/useGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flame, Trophy, Star, Lock } from 'lucide-react';

export default function ConquistasPage() {
  const { unlockedBadges, lockedBadges, streak, level, xpProgress } = useGamification();

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-bold">Conquistas</h2>
        <p className="text-muted-foreground text-sm">Suas medalhas, sequências e nível</p>
      </div>

      {/* Level & Streak cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <Card className="card-glass">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Star className="text-primary" size={20} />
              </div>
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
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <Flame className="text-destructive" size={20} />
              </div>
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
              <div className="p-2.5 rounded-xl bg-accent/10">
                <Trophy className="text-accent" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recorde</p>
                <p className="text-lg font-bold text-accent">{streak.best_streak} dias</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Melhor sequência</p>
          </CardContent>
        </Card>
      </div>

      {/* Unlocked badges */}
      <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Medalhas Conquistadas ({unlockedBadges.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unlockedBadges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              Nenhuma medalha ainda. Continue usando o app para conquistar!
            </p>
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

      {/* Locked badges */}
      <Card className="card-glass animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            A Desbloquear ({lockedBadges.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lockedBadges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              🎉 Parabéns! Todas as medalhas foram conquistadas!
            </p>
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
    </div>
  );
}
