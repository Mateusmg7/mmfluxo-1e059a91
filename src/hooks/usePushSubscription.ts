import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getNotificationServiceWorkerRegistration } from '@/lib/notificationServiceWorker';

const VAPID_PUBLIC_KEY = 'BLoIM5cCeE_wZ_jjx0SJbVhG-5ZO2kut3CQfwJjE73IFl0sGhKAjbXxRzRTGFc1qXIM5MUgz0dNzP-nPZSNF_FE';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribe = async () => {
      try {
        const registration = await getNotificationServiceWorkerRegistration();
        if (!registration) return;
        
        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();
        
        // If existing subscription uses a different VAPID key, unsubscribe and re-create
        if (subscription) {
          try {
            const existingKey = subscription.options?.applicationServerKey;
            const newKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            if (existingKey) {
              const existingArr = new Uint8Array(existingKey);
              if (existingArr.length !== newKey.length || existingArr.some((v, i) => v !== newKey[i])) {
                await subscription.unsubscribe();
                subscription = null;
              }
            }
          } catch {
            await subscription.unsubscribe();
            subscription = null;
          }
        }
        
        if (!subscription) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
          });
        }

        const key = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        if (!key || !auth) return;

        const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
        const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

        // Save to database (upsert by endpoint)
        await (supabase as any).from('push_subscriptions').upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: p256dh,
            auth: authKey,
          },
          { onConflict: 'user_id,endpoint' }
        );

        subscribedRef.current = true;
      } catch (err) {
        console.error('Push subscription error:', err);
      }
    };

    subscribe();
  }, [user]);
}

export async function sendTestPushNotification(
  userId: string,
  payload: { title: string; body: string; tag: string }
): Promise<boolean> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/send-push-notifications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ test: true, user_id: userId, payload }),
      }
    );

    const result = await response.json();
    return result.sent > 0;
  } catch {
    return false;
  }
}
