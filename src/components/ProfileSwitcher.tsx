import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import DuplicateDataDialog from '@/components/dialogs/DuplicateDataDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, ChevronDown, Plus, Pencil, Trash2, Copy, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = ['👤', '👨‍👩‍👧‍👦', '🏢', '🏠', '💼'];
const COLORS = ['#0C5BA8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfileId, createProfile, updateProfile, deleteProfile } = useProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('👤');
  const [color, setColor] = useState('#0C5BA8');

  useEffect(() => {
    if (activeProfile?.color) {
      const hsl = hexToHsl(activeProfile.color);
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--ring', hsl);
    }
  }, [activeProfile?.color]);

  const resetForm = () => { setName(''); setIcon('👤'); setColor('#0C5BA8'); setEditId(null); };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editId) {
      await updateProfile(editId, name, icon, color);
    } else {
      await createProfile(name, icon, color);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleEditClick = (p: any) => {
    setEditId(p.id);
    setName(p.name);
    setIcon(p.icon);
    setColor(p.color || '#0C5BA8');
    setDialogOpen(true);
  };

  if (!activeProfile) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-sm font-medium transition-colors">
            <span>{activeProfile.icon}</span>
            <span className="hidden sm:inline max-w-[100px] truncate">{activeProfile.name}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {profiles.map((p) => (
            <DropdownMenuItem
              key={p.id}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setActiveProfileId(p.id)}
            >
              <div className="flex items-center gap-2">
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {p.id === activeProfile.id && <Check size={14} className="text-primary" />}
                <button
                  onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground"
                >
                  <Pencil size={12} />
                </button>
                {!p.is_default && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProfile(p.id); }}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          {profiles.length < 5 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { resetForm(); setDialogOpen(true); }}
                className="cursor-pointer"
              >
                <Plus size={14} className="mr-2" />
                Novo perfil
              </DropdownMenuItem>
            </>
          )}
          {profiles.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDuplicateOpen(true)}
                className="cursor-pointer"
              >
                <Copy size={14} className="mr-2" />
                Duplicar dados de outro perfil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar' : 'Novo'} Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Família" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex gap-2">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={cn(
                      'text-xl p-2 rounded-lg border transition-colors',
                      icon === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-transform',
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateDataDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} />
    </>
  );
}
