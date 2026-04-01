import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getNotificationServiceWorkerRegistration } from '@/lib/notificationServiceWorker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ensurePushSubscription } from '@/hooks/usePushSubscription';

interface DebugState {
  permission: NotificationPermission | 'unsupported';
  swState: 'unsupported' | 'no-registration' | 'installing' | 'waiting' | 'active';
  swScope: string;
  hasSubscription: boolean;
  subscriptionEndpoint: string;
  dbSubscriptions: number;
  lastCheck: string;
}

export default function PushDebugPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DebugState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const permission: NotificationPermission | 'unsupported' =
        'Notification' in window ? Notification.permission : 'unsupported';

      let swState: DebugState['swState'] = 'unsupported';
      let swScope = '';
      let hasSubscription = false;
      let subscriptionEndpoint = '';

      if ('serviceWorker' in navigator) {
        const reg = await getNotificationServiceWorkerRegistration();
        if (reg) {
          swScope = reg.scope;
          if (reg.active) swState = 'active';
          else if (reg.waiting) swState = 'waiting';
          else if (reg.installing) swState = 'installing';
          else swState = 'no-registration';

          const sub = await reg.pushManager.getSubscription();
          hasSubscription = !!sub;
          subscriptionEndpoint = sub?.endpoint?.slice(0, 80) + '...' || '';
        } else {
          swState = 'no-registration';
        }
      }

      let dbSubscriptions = 0;
      if (user) {
        const { data, error } = await (supabase as any)
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id);
        if (!error && data) dbSubscriptions = data.length;
      }

      setState({
        permission,
        swState,
        swScope,
        hasSubscription,
        subscriptionEndpoint,
        dbSubscriptions,
        lastCheck: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (err) {
      console.error('[PushDebug] Error:', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && !state) refresh();
  }, [open, state, refresh]);

  const handleForceResubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      console.log('[PushDebug] Forcing re-subscription...');
      const success = await ensurePushSubscription(user.id, true);
      console.log('[PushDebug] Re-subscription result:', success);
      await refresh();
    } catch (err) {
      console.error('[PushDebug] Re-subscribe error:', err);
    }
    setLoading(false);
  };

  const badgeColor = (ok: boolean) =>
    ok ? 'bg-green-500/20 text-green-600 border-green-500/30' : 'bg-red-500/20 text-red-600 border-red-500/30';

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="py-2 px-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
          <Bug size={14} />
          Push Debug
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-3 space-y-2 text-xs">
          {state ? (
            <>
              <div className="flex items-center justify-between">
                <span>Notification.permission</span>
                <Badge variant="outline" className={badgeColor(state.permission === 'granted')}>
                  {state.permission}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Service Worker</span>
                <Badge variant="outline" className={badgeColor(state.swState === 'active')}>
                  {state.swState}
                </Badge>
              </div>
              {state.swScope && (
                <div className="flex items-center justify-between">
                  <span>SW Scope</span>
                  <span className="text-muted-foreground font-mono text-[10px]">{state.swScope}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Browser Subscription</span>
                <Badge variant="outline" className={badgeColor(state.hasSubscription)}>
                  {state.hasSubscription ? 'Ativa' : 'Nenhuma'}
                </Badge>
              </div>
              {state.subscriptionEndpoint && (
                <div className="text-[10px] text-muted-foreground font-mono break-all">
                  {state.subscriptionEndpoint}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Assinaturas no banco</span>
                <Badge variant="outline" className={badgeColor(state.dbSubscriptions > 0)}>
                  {state.dbSubscriptions}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Última verificação: {state.lastCheck}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">Carregando...</span>
          )}

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="text-xs h-7">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={handleForceResubscribe} disabled={loading} className="text-xs h-7">
              Forçar Re-assinatura
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
