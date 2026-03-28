import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DuplicateDataDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { profiles, activeProfile } = useProfile();
  const qc = useQueryClient();

  const [sourceProfileId, setSourceProfileId] = useState('');
  const [copyCategories, setCopyCategories] = useState(true);
  const [copyTransactions, setCopyTransactions] = useState(false);
  const [loading, setLoading] = useState(false);

  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);

  const handleDuplicate = async () => {
    if (!sourceProfileId || !activeProfile || !user) return;
    if (!copyCategories && !copyTransactions) {
      toast.error('Selecione ao menos uma opção');
      return;
    }

    setLoading(true);
    try {
      // Build a mapping from old category IDs to new ones (needed for transactions)
      const categoryMap = new Map<string, string>();

      if (copyCategories) {
        const { data: sourceCats, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .eq('profile_id', sourceProfileId);
        if (catErr) throw catErr;

        if (sourceCats && sourceCats.length > 0) {
          // Get existing categories in target to avoid duplicates by name
          const { data: existingCats } = await supabase
            .from('categories')
            .select('nome, id')
            .eq('profile_id', activeProfile.id);
          const existingNames = new Set((existingCats ?? []).map((c) => c.nome));

          const toInsert = sourceCats
            .filter((c) => !existingNames.has(c.nome))
            .map((c) => ({
              user_id: user.id,
              nome: c.nome,
              cor_hex: c.cor_hex,
              grupo: c.grupo,
              is_default: false,
              profile_id: activeProfile.id,
            }));

          if (toInsert.length > 0) {
            const { data: newCats, error: insErr } = await supabase
              .from('categories')
              .insert(toInsert)
              .select();
            if (insErr) throw insErr;

            // Map source cat names to new IDs
            newCats?.forEach((nc) => {
              const src = sourceCats.find((sc) => sc.nome === nc.nome);
              if (src) categoryMap.set(src.id, nc.id);
            });
          }

          // Also map existing categories that already had matching names
          existingCats?.forEach((ec) => {
            const src = sourceCats.find((sc) => sc.nome === ec.nome);
            if (src) categoryMap.set(src.id, ec.id);
          });

          toast.success(`${toInsert.length} categorias duplicadas`);
        }
      }

      if (copyTransactions) {
        // If we didn't copy categories, build the map from matching names
        if (!copyCategories) {
          const { data: sourceCats } = await supabase
            .from('categories')
            .select('id, nome')
            .eq('profile_id', sourceProfileId);
          const { data: targetCats } = await supabase
            .from('categories')
            .select('id, nome')
            .eq('profile_id', activeProfile.id);

          sourceCats?.forEach((sc) => {
            const match = targetCats?.find((tc) => tc.nome === sc.nome);
            if (match) categoryMap.set(sc.id, match.id);
          });
        }

        const { data: sourceTx, error: txErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('profile_id', sourceProfileId);
        if (txErr) throw txErr;

        if (sourceTx && sourceTx.length > 0) {
          const mappedTx = sourceTx
            .filter((t) => categoryMap.has(t.category_id))
            .map((t) => ({
              user_id: user.id,
              category_id: categoryMap.get(t.category_id)!,
              valor: t.valor,
              data: t.data,
              hora: t.hora,
              descricao: t.descricao,
              status: t.status,
              profile_id: activeProfile.id,
            }));

          if (mappedTx.length > 0) {
            const { error: insTxErr } = await supabase
              .from('transactions')
              .insert(mappedTx);
            if (insTxErr) throw insTxErr;
          }

          const skipped = sourceTx.length - mappedTx.length;
          toast.success(
            `${mappedTx.length} transações duplicadas` +
              (skipped > 0 ? ` (${skipped} ignoradas por falta de categoria correspondente)` : '')
          );
        } else {
          toast.info('Nenhuma transação encontrada no perfil de origem');
        }
      }

      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy size={18} />
            Duplicar dados
          </DialogTitle>
          <DialogDescription>
            Copie categorias e/ou transações de outro perfil para{' '}
            <strong>{activeProfile?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Perfil de origem</Label>
            <Select value={sourceProfileId} onValueChange={setSourceProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                {otherProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>O que duplicar</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="copy-cats"
                checked={copyCategories}
                onCheckedChange={(v) => setCopyCategories(v === true)}
              />
              <label htmlFor="copy-cats" className="text-sm cursor-pointer">
                Categorias (ignora nomes duplicados)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="copy-tx"
                checked={copyTransactions}
                onCheckedChange={(v) => setCopyTransactions(v === true)}
              />
              <label htmlFor="copy-tx" className="text-sm cursor-pointer">
                Transações (vincula por nome da categoria)
              </label>
            </div>
          </div>

          <Button
            onClick={handleDuplicate}
            disabled={!sourceProfileId || loading || (!copyCategories && !copyTransactions)}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Duplicando...
              </>
            ) : (
              'Duplicar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
