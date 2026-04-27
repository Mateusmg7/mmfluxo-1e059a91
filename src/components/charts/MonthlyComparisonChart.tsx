import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { qk } from '@/lib/queryKeys';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Filter, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  userId: string;
  profileId: string | undefined;
  currentMonth: Date;
}

export function MonthlyComparisonChart({ userId, profileId, currentMonth }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const prevMonth = subMonths(currentMonth, 1);

  const curStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const curEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

  const curLabel = format(currentMonth, 'MMM', { locale: ptBR });
  const prevLabel = format(prevMonth, 'MMM', { locale: ptBR });

  const { data: curTx = [], isLoading: isLoadingCur, isError: isErrorCur } = useQuery({
    queryKey: qk.comparison.current(profileId, curStart, curEnd),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('valor, categories(nome)')
        .gte('data', curStart)
        .lte('data', curEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  const { data: prevTx = [], isLoading: isLoadingPrev, isError: isErrorPrev } = useQuery({
    queryKey: qk.comparison.previous(profileId, prevStart, prevEnd),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('valor, categories(nome)')
        .gte('data', prevStart)
        .lte('data', prevEnd);
      if (profileId) q = q.eq('profile_id', profileId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && !!profileId,
  });

  const isLoading = isLoadingCur || isLoadingPrev;
  const isError = isErrorCur || isErrorPrev;

  // Aggregate by category
  const aggregate = (txs: any[]) => {
    const map = new Map<string, number>();
    txs.forEach((t) => {
      const cat = t.categories?.nome ?? 'Outros';
      map.set(cat, (map.get(cat) ?? 0) + Number(t.valor));
    });
    return map;
  };

  const curMap = aggregate(curTx);
  const prevMap = aggregate(prevTx);

  const allCategoriesList = useMemo(() => {
    const set = new Set([...curMap.keys(), ...prevMap.keys()]);
    return Array.from(set).sort();
  }, [curMap, prevMap]);

  // Initial state: select all when new categories appear
  useEffect(() => {
    if (allCategoriesList.length > 0) {
      // Find categories that aren't already selected but exist now
      const newToSelect = allCategoriesList.filter(cat => !selectedCategories.includes(cat));
      if (newToSelect.length > 0 && selectedCategories.length === 0) {
        // First load or empty state: select all
        setSelectedCategories(allCategoriesList);
      }
    }
  }, [allCategoriesList]);

  const chartData = useMemo(() => {
    return allCategoriesList
      .filter(cat => selectedCategories.includes(cat))
      .map((cat) => ({
        categoria: cat,
        atual: curMap.get(cat) ?? 0,
        anterior: prevMap.get(cat) ?? 0,
      }))
      .sort((a, b) => (b.atual + b.anterior) - (a.atual + a.anterior));
  }, [allCategoriesList, selectedCategories, curMap, prevMap]);

  const hasData = chartData.some((d) => d.atual > 0 || d.anterior > 0);

  const totalCur = chartData.reduce((s, d) => s + d.atual, 0);
  const totalPrev = chartData.reduce((s, d) => s + d.anterior, 0);
  const diffPct = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : 0;

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Find categories with biggest increase
  const variations = chartData
    .map((d) => ({
      cat: d.categoria,
      diff: d.atual - d.anterior,
      pct: d.anterior > 0 ? ((d.atual - d.anterior) / d.anterior) * 100 : d.atual > 0 ? 100 : 0,
    }))
    .filter((v) => Math.abs(v.diff) > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat) 
        : [...prev, cat]
    );
  };

  return (
    <Card className="card-glass border-none shadow-lg animate-scale-up" style={{ animationDelay: '0.25s' }}>
      <CardHeader className="pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Análise Comparativa
            </CardTitle>
            {hasData && (
              <p className="text-xs text-muted-foreground mt-1">
                Comparação detalhada de gastos: <span className="font-semibold text-foreground">{format(currentMonth, 'MMMM', { locale: ptBR })}</span> vs {format(prevMonth, 'MMMM', { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {allCategoriesList.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold">
                    <Filter className="h-3.5 w-3.5" />
                    Categorias
                    <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                      {selectedCategories.length}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0 border-white/10 bg-[#1A1F2C] text-white" align="end">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtrar por</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-0 text-[10px] hover:bg-transparent text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedCategories.length === allCategoriesList.length) {
                          setSelectedCategories([]);
                        } else {
                          setSelectedCategories(allCategoriesList);
                        }
                      }}
                    >
                      {selectedCategories.length === allCategoriesList.length ? 'Limpar' : 'Todos'}
                    </Button>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-1">
                      {allCategoriesList.map((cat) => (
                        <div
                          key={cat}
                          className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => toggleCategory(cat)}
                        >
                          <span className="text-sm font-medium">{cat}</span>
                          {selectedCategories.includes(cat) && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            
            {hasData && totalPrev > 0 && (
              <div className={`flex flex-col items-end`}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${diffPct > 0 ? 'bg-destructive/10 text-destructive' : diffPct < 0 ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                  {diffPct > 0 ? <TrendingUp size={14} /> : diffPct < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter font-medium">Variação Total</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Carregando dados comparativos...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="bg-destructive/10 p-4 rounded-full">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Erro ao carregar dados</p>
              <p className="text-xs text-muted-foreground mt-1">Não foi possível conectar ao Supabase.</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : !hasData ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Sem dados para comparar
          </p>
        ) : (
          <>
            <div className="h-[400px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="prevGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="white" vertical={false} opacity={0.05} />
                  <XAxis
                    dataKey="categoria"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={70}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 10)}...` : value}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'white', opacity: 0.05 }}
                    formatter={(v: number, name: string) => [fmt(v), name]}
                    contentStyle={{
                      backgroundColor: '#1A1F2C',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      color: 'white',
                      fontSize: '13px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                      padding: '12px',
                      backdropFilter: 'blur(10px)',
                      zIndex: 50
                    }}
                    itemStyle={{ padding: '2px 0', fontWeight: 500 }}
                    labelStyle={{ marginBottom: '8px', fontWeight: 800, color: 'hsl(var(--primary))', fontSize: '14px' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="center"
                    layout="horizontal"
                    wrapperStyle={{ paddingBottom: 35, paddingTop: 0, width: '100%' }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{value}</span>
                    )}
                  />
                  <Bar 
                    dataKey="anterior" 
                    name={`Gasto em ${prevLabel}`} 
                    fill="url(#prevGradient)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={24}
                  />
                  <Bar 
                    dataKey="atual" 
                    name={`Gasto em ${curLabel}`} 
                    fill="url(#barGradient)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {variations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Maiores variações</p>
                {variations.map((v) => (
                  <div key={v.cat} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-muted/30">
                    <span className="font-medium">{v.cat}</span>
                    <div className={`flex items-center gap-1 font-semibold ${v.diff > 0 ? 'text-destructive' : 'text-accent'}`}>
                      {v.diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {v.diff > 0 ? '+' : ''}{fmt(v.diff)}
                      {v.pct !== 100 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({v.diff > 0 ? '+' : ''}{v.pct.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedCategories.length === 0 && allCategoriesList.length > 0 && (
              <div className="mt-8 flex flex-col items-center justify-center p-8 bg-muted/20 rounded-2xl border border-dashed border-muted/50">
                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Nenhuma categoria selecionada para comparação.</p>
                <Button 
                  variant="link" 
                  className="mt-2 text-primary"
                  onClick={() => setSelectedCategories(allCategoriesList)}
                >
                  Selecionar todas
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
