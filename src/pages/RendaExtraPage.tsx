import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RendaExtraPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();

  const [periodo, setPeriodo] = useState('atual');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [origem, setOrigem] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(format(now, 'yyyy-MM-dd'));
  const [hora, setHora] = useState(format(now, 'HH:mm'));
  const [observacao, setObservacao] = useState('');

  const getDateRange = () => {
    if (periodo === 'anterior') {
      const prev = subMonths(now, 1);
      return { start: format(startOfMonth(prev), 'yyyy-MM-dd'), end: format(endOfMonth(prev), 'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  };

  const { start, end } = getDateRange();

  const { data: records = [] } = useQuery({
    queryKey: ['extra_income', start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_income')
        .select('*')
        .gte('data', start)
        .lte('data', end)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const total = records.reduce((s, r) => s + Number(r.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const resetForm = () => {
    setOrigem(''); setValor(''); setData(format(now, 'yyyy-MM-dd'));
    setHora(format(now, 'HH:mm')); setObservacao(''); setEditId(null);
  };

  const handleSave = async () => {
    if (!origem || !valor) { toast.error('Preencha origem e valor'); return; }
    const payload = { user_id: user!.id, origem, valor: parseFloat(valor), data, hora, observacao: observacao || null };

    if (editId) {
      const { error } = await supabase.from('extra_income').update(payload).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Renda atualizada');
    } else {
      const { error } = await supabase.from('extra_income').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Renda adicionada');
    }
    qc.invalidateQueries({ queryKey: ['extra_income'] });
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (r: any) => {
    setEditId(r.id); setOrigem(r.origem); setValor(String(r.valor));
    setData(r.data); setHora(r.hora); setObservacao(r.observacao ?? '');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('extra_income').delete().eq('id', id);
    toast.success('Removido');
    qc.invalidateQueries({ queryKey: ['extra_income'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Renda Extra</h2>
          <p className="text-muted-foreground text-sm">Freelas, bicos e entradas extras</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90"><Plus size={16} className="mr-2" />Adicionar renda</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Nova'} Renda Extra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: Freela design" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent/90">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="atual">Mês atual</SelectItem>
            <SelectItem value="anterior">Mês anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="card-glass">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="text-accent" size={24} />
            <span className="text-muted-foreground">Total no período</span>
          </div>
          <span className="text-xl font-bold text-accent">{fmt(total)}</span>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {records.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma renda extra registrada.</p>}
        {records.map((r) => (
          <Card key={r.id} className="card-glass">
            <CardContent className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.origem}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(r.data + 'T00:00'), 'dd/MM', { locale: ptBR })} · {r.hora}
                  {r.observacao && ` · ${r.observacao}`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-semibold text-accent">{fmt(Number(r.valor))}</span>
                <button onClick={() => handleEdit(r)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
