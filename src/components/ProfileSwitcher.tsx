import { useState, useEffect, useRef } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import DuplicateDataDialog from '@/components/dialogs/DuplicateDataDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
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
import { Check, ChevronDown, Plus, Pencil, Trash2, Copy, Palette, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('👤');
  const [color, setColor] = useState('#0C5BA8');
  const [pin, setPin] = useState('');
  
  // States for PIN entry dialog
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState(['', '', '', '']);
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const pinInputs = useRef<(HTMLInputElement | null)[]>([]);
  const resetInputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (activeProfile?.color) {
      const hsl = hexToHsl(activeProfile.color);
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--ring', hsl);
    }
  }, [activeProfile?.color]);

  const resetForm = () => { 
    setName(''); 
    setIcon('👤'); 
    setColor('#0C5BA8'); 
    setPin('');
    setEditId(null); 
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (pin && pin.length !== 4) {
      toast.error('O PIN deve ter 4 dígitos');
      return;
    }

    if (editId) {
      await updateProfile(editId, name, icon, color, pin || undefined);
    } else {
      await createProfile(name, icon, color, pin || undefined);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleProfileSelect = (p: any) => {
    if (p.pin && p.id !== activeProfile?.id) {
      setPendingProfileId(p.id);
      setEnteredPin(['', '', '', '']);
      setPinDialogOpen(true);
      setTimeout(() => pinInputs.current[0]?.focus(), 100);
    } else {
      setActiveProfileId(p.id);
    }
  };

  const handleSendResetCode = async () => {
    if (!pendingProfileId) return;
    setIsSendingCode(true);
    
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('financial_profiles')
        .update({ pin_reset_code: code, pin_reset_expires: expires })
        .eq('id', pendingProfileId);

      if (error) throw error;

      // In a real app with configured email, this would be an Edge Function call.
      // Since email setup requires user interaction, we show the code in a toast 
      // for now so they can test the flow.
      toast.info(`Código de recuperação (simulado): ${code}`, { duration: 10000 });
      setResetDialogOpen(true);
      setPinDialogOpen(false);
      setTimeout(() => resetInputs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast.error('Erro ao enviar código: ' + err.message);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyResetCode = async () => {
    const finalCode = resetCode.join('');
    const targetProfile = profiles.find(p => p.id === pendingProfileId);
    
    if (targetProfile && targetProfile.pin_reset_code === finalCode) {
      const isExpired = targetProfile.pin_reset_expires && new Date(targetProfile.pin_reset_expires) < new Date();
      if (isExpired) {
        toast.error('Código expirado');
        return;
      }

      // Reset the PIN
      const { error } = await supabase
        .from('financial_profiles')
        .update({ pin: null, pin_reset_code: null, pin_reset_expires: null })
        .eq('id', pendingProfileId);

      if (error) {
        toast.error('Erro ao resetar PIN');
      } else {
        toast.success('PIN removido com sucesso!');
        setActiveProfileId(pendingProfileId!);
        setResetDialogOpen(false);
        setPendingProfileId(null);
      }
    } else {
      toast.error('Código inválido');
    }
  };

  const handlePinSubmit = () => {
    const finalPin = enteredPin.join('');
    const targetProfile = profiles.find(p => p.id === pendingProfileId);
    
    if (targetProfile && targetProfile.pin === finalPin) {
      setActiveProfileId(pendingProfileId!);
      setPinDialogOpen(false);
      setPendingProfileId(null);
      setEnteredPin(['', '', '', '']);
    } else {
      toast.error('PIN incorreto');
      setEnteredPin(['', '', '', '']);
      pinInputs.current[0]?.focus();
    }
  };

  const handlePinInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...enteredPin];
    newPin[index] = value.slice(-1);
    setEnteredPin(newPin);
    if (value && index < 3) pinInputs.current[index + 1]?.focus();
  };

  const handleResetInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...resetCode];
    newCode[index] = value.slice(-1);
    setResetCode(newCode);
    if (value && index < 5) resetInputs.current[index + 1]?.focus();
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !enteredPin[index] && index > 0) {
      pinInputs.current[index - 1]?.focus();
    } else if (e.key === 'Enter' && enteredPin.every(v => v !== '')) {
      handlePinSubmit();
    }
  };

  const handleResetKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      resetInputs.current[index - 1]?.focus();
    } else if (e.key === 'Enter' && resetCode.every(v => v !== '')) {
      handleVerifyResetCode();
    }
  };

  const handleEditClick = (p: any) => {
    setEditId(p.id);
    setName(p.name);
    setIcon(p.icon);
    setColor(p.color || '#0C5BA8');
    setPin(p.pin || '');
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {activeProfile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-sm font-medium transition-all hover:scale-105 active:scale-95 group">
            <span 
              className="flex items-center justify-center w-6 h-6 rounded-full transition-transform group-hover:rotate-12 border border-black/20" 
              style={{ backgroundColor: activeProfile.color, color: 'rgb(75, 85, 99)' }}
            >
              {activeProfile.icon}
            </span>
            <span className="max-w-[100px] truncate">{activeProfile.name}</span>
            <ChevronDown size={14} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 bg-card/95 backdrop-blur-md border-border shadow-xl">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Seus Perfis
              </div>
              {profiles.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between cursor-pointer rounded-md px-2 py-2 mb-1 transition-all",
                    p.id === activeProfile.id ? "bg-opacity-20 shadow-sm" : "hover:bg-secondary/80"
                  )}
                  style={p.id === activeProfile.id ? { backgroundColor: p.color + '15' } : undefined}
                  onClick={() => handleProfileSelect(p)}
                >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full text-lg shadow-sm border border-black/20" style={{ backgroundColor: p.color, color: '#4B5563' }}>
                  {p.icon}
                </span>
                    <span className={cn(
                      "truncate max-w-[120px] transition-colors flex items-center gap-1.5",
                      p.id === activeProfile.id ? "font-bold" : ""
                    )} style={{ color: p.id === activeProfile.id ? p.color : undefined }}>
                      {p.name}
                      {p.pin && <Lock size={10} className="text-muted-foreground/60" />}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.id === activeProfile.id && <Check size={16} className="text-primary mr-1 animate-in zoom-in-50" />}
                    <button
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        handleEditClick(p); 
                      }}
                      className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-primary transition-colors"
                      title="Editar perfil"
                    >
                      <Pencil size={14} />
                    </button>
                    {!p.is_default && (
                      <button
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          setProfileToDelete(p.id);
                          setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remover perfil"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              {profiles.length < 5 && (
                <DropdownMenuItem
                  onClick={() => { resetForm(); setDialogOpen(true); }}
                  className="cursor-pointer rounded-md px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                >
                  <Plus size={16} className="mr-2" />
                  Novo perfil
                </DropdownMenuItem>
              )}
              {profiles.length > 1 && (
                <DropdownMenuItem
                  onClick={() => setDuplicateOpen(true)}
                  className="cursor-pointer rounded-md px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                >
                  <Copy size={16} className="mr-2" />
                  Duplicar dados
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-secondary/50 border-none hover:bg-secondary transition-all"
            onClick={() => {
              if (profiles.length > 0) {
                // Try to restore from localStorage even if it has a PIN, 
                // handleProfileSelect will trigger the dialog
                const storedId = localStorage.getItem('mm_active_profile_hint');
                const target = profiles.find(p => p.id === storedId) || profiles[0];
                handleProfileSelect(target);
              }
            }}
          >
            <Lock size={14} className="text-primary" />
            <span>Desbloquear Perfil</span>
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border max-w-sm animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette size={18} className="text-primary" />
              {editId ? 'Configurações do Perfil' : 'Criar Novo Perfil'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Nome do Perfil</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: Pessoal, Empresa..." 
                maxLength={20}
                className="bg-secondary/30 border-border/50 focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Ícone Representativo</Label>
              <div className="flex justify-between gap-1 p-1 bg-secondary/20 rounded-xl border border-border/30">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn(
                      'text-2xl w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200',
                      icon === i 
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110' 
                        : 'hover:bg-secondary/50 text-foreground/70'
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Cor de Identificação</Label>
              <div className="space-y-3">
                <div className="flex justify-between p-1 bg-secondary/20 rounded-xl border border-border/30">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'w-10 h-10 rounded-lg border-2 transition-all duration-200 flex items-center justify-center',
                        color === c 
                          ? 'border-white ring-2 ring-primary scale-110 shadow-md' 
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check size={14} className="text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 px-1">
                  <Label htmlFor="custom-color" className="text-[11px] text-muted-foreground whitespace-nowrap">Cor personalizada:</Label>
                  <div className="relative flex-1 h-8">
                    <input
                      id="custom-color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div 
                      className="w-full h-full rounded-md border border-border shadow-sm flex items-center justify-center text-[10px] font-mono text-white mix-blend-difference"
                      style={{ backgroundColor: color }}
                    >
                      {color.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                Senha PIN (4 dígitos)
                {pin ? <Lock size={12} className="text-primary" /> : <Unlock size={12} className="text-muted-foreground" />}
              </Label>
              <Input 
                value={pin} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                }} 
                placeholder="Opcional" 
                maxLength={4}
                type="password"
                inputMode="numeric"
                className="bg-secondary/30 border-border/50 focus:border-primary/50 tracking-[1em] text-center font-bold"
              />
              <p className="text-[10px] text-muted-foreground">Deixe em branco para remover a senha.</p>
            </div>
            <Button onClick={handleSave} className="w-full h-11 shadow-lg shadow-primary/20 transition-all active:scale-95 font-semibold">
              {editId ? 'Atualizar Perfil' : 'Criar Perfil'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pinDialogOpen} onOpenChange={(o) => {
        if (!o) {
          setPinDialogOpen(false);
          setPendingProfileId(null);
          setEnteredPin(['', '', '', '']);
        }
      }}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border max-w-[280px] p-6 animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader className="space-y-3">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="text-primary" size={24} />
            </div>
            <DialogTitle className="text-center">Acesso Protegido</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-xs text-center text-muted-foreground">Insira o PIN de 4 dígitos para acessar este perfil.</p>
            <div className="flex justify-center gap-3">
              {enteredPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (pinInputs.current[idx] = el)}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinInputChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  className="w-10 h-12 text-center text-xl font-bold bg-secondary/40 border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              ))}
            </div>
            <Button 
              onClick={handlePinSubmit} 
              className="w-full"
              disabled={enteredPin.some(d => d === '')}
            >
              Confirmar
            </Button>
            
            <button 
              onClick={handleSendResetCode}
              disabled={isSendingCode}
              className="w-full text-[10px] text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              {isSendingCode ? 'Enviando...' : 'Esqueci minha senha'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset PIN Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(o) => {
        if (!o) {
          setResetDialogOpen(false);
          setPendingProfileId(null);
          setResetCode(['', '', '', '', '', '']);
        }
      }}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border max-w-[320px] p-6 animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader className="space-y-3">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Unlock className="text-primary" size={24} />
            </div>
            <DialogTitle className="text-center">Recuperar PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <p className="text-xs text-center text-muted-foreground">
              Insira o código de 6 dígitos enviado para seu e-mail para remover a senha do perfil.
            </p>
            <div className="flex justify-center gap-2">
              {resetCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (resetInputs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleResetInputChange(idx, e.target.value)}
                  onKeyDown={(e) => handleResetKeyDown(idx, e)}
                  className="w-8 h-10 text-center text-lg font-bold bg-secondary/40 border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              ))}
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleVerifyResetCode} 
                className="w-full"
                disabled={resetCode.some(d => d === '')}
              >
                Verificar e Desbloquear
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setResetDialogOpen(false);
                  setPinDialogOpen(true);
                }}
                className="w-full text-[10px]"
              >
                Voltar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateDataDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} />
      
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => {
          if (profileToDelete) {
            deleteProfile(profileToDelete);
            setProfileToDelete(null);
          }
        }}
        title="Excluir Perfil"
        description="Tem certeza que deseja excluir este perfil? Todos os dados vinculados a ele serão removidos permanentemente."
      />
    </>
  );
}
