import { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriasPage() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [corHex, setCorHex] = useState('#0C5BA8');
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', activeProfile?.id],
    queryFn: async () => {
      let q = supabase.from('categories').select('*').eq('grupo', 'essenciais').order('nome');
      if (activeProfile) q = q.eq('profile_id', activeProfile.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user && !!activeProfile,
  });

  const resetForm = () => { setNome(''); setCorHex('#0C5BA8'); setEditId(null); };

  const handleSave = async () => {
    if (!nome) { toast.error('Informe o nome'); return; }
    const payload = { user_id: user!.id, nome, cor_hex: corHex, grupo: 'essenciais' as const, profile_id: activeProfile?.id };

    if (editId) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria atualizada');
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria criada');
    }
    qc.invalidateQueries({ queryKey: ['categories'] });
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (c: any) => {
    setEditId(c.id); setNome(c.nome); setCorHex(c.cor_hex);
    setDialogOpen(true);
  };

  const confirmDelete = (c: any) => {
    if (c.is_default) { toast.error('Não é possível excluir categorias padrão'); return; }
    setDeleteItem(c);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from('categories').delete().eq('id', deleteItem.id);
    if (error) { toast.error('Categoria em uso, não pode ser excluída'); setDeleteDialogOpen(false); setDeleteItem(null); return; }
    toast.success('Categoria removida');
    qc.invalidateQueries({ queryKey: ['categories'] });
    setDeleteDialogOpen(false);
    setDeleteItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Categorias Essenciais</h2>
          <p className="text-muted-foreground text-sm">Gerencie categorias de despesas essenciais</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Nova categoria</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar' : 'Nova'} Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Alimentação" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={corHex} onChange={(e) => setCorHex(e.target.value)} className="h-10 p-1" />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => (
          <Card key={c.id} className="card-glass">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.cor_hex }} />
                <span className="font-medium">{c.nome}</span>
                {c.is_default && <Badge variant="secondary" className="text-xs">padrão</Badge>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Pencil size={14} /></button>
                {!c.is_default && (
                  <button onClick={() => confirmDelete(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
