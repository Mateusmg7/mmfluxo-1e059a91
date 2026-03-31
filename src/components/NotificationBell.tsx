import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('notif_last_seen');
    if (stored) setLastSeenAt(stored);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      const { data } = await (supabase as any)
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) {
        setLogs(data);
        if (lastSeenAt) {
          setUnseenCount(data.filter((l: NotificationLog) => l.created_at > lastSeenAt).length);
        } else {
          setUnseenCount(data.length);
        }
      }
    };

    fetchLogs();

    const channel = supabase
      .channel('notification_logs_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_logs',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        const newLog = payload.new as NotificationLog;
        setLogs(prev => [newLog, ...prev].slice(0, 30));
        if (!open) {
          setUnseenCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, lastSeenAt]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setUnseenCount(0);
      const now = new Date().toISOString();
      setLastSeenAt(now);
      localStorage.setItem('notif_last_seen', now);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell size={20} />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Histórico de Notificações</h3>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
              title="Limpar histórico"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <ScrollArea className="h-72">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.body}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      log.type === 'test' ? 'bg-accent text-accent-foreground' : 'bg-primary/15 text-primary'
                    }`}>
                      {log.type === 'test' ? 'teste' : 'auto'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
