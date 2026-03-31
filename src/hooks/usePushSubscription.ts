import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getNotificationServiceWorkerRegistration } from '@/lib/notificationServiceWorker';

const VAPID_PUBLIC_KEY = 'BJa-tf75KJ3yKlDmXlG0pKmw1lVMwNa5lXC4Rkmp7nTov72bEHXOryzp9x0KlK_IAB26n5_VK0tRrM3zNhWBhA8';

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

async function createPushSubscription(userId: string, forceResubscribe = false): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }

  const registration = await getNotificationServiceWorkerRegistration();
  if (!registration) return false;

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') return false;

  const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    try {
      const existingKey = subscription.options?.applicationServerKey;
      const existingArr = existingKey ? new Uint8Array(existingKey) : null;
      const keyChanged = !existingArr || existingArr.length !== vapidKey.length || existingArr.some((v, i) => v !== vapidKey[i]);

      if (forceResubscribe || keyChanged) {
        await subscription.unsubscribe();
        subscription = null;
      }
    } catch {
      try {
        await subscription.unsubscribe();
      } catch {
        // ignore stale subscription cleanup errors
      }
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey.buffer as ArrayBuffer,
    });
  }

  const key = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!key || !auth) return false;

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
  const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

  await (supabase as any)
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  const { error } = await (supabase as any).from('push_subscriptions').insert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth: authKey,
  });

  if (error) throw error;
  return true;
}

export async function ensurePushSubscription(userId: string, forceResubscribe = false): Promise<boolean> {
  try {
    return await createPushSubscription(userId, forceResubscribe);
  } catch (err) {
    console.error('Push subscription error:', err);
    return false;
  }
}

export function usePushSubscription() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribe = async () => {
      const success = await ensurePushSubscription(user.id);
      if (success) {
        subscribedRef.current = true;
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
    const ready = await ensurePushSubscription(userId, true);
    if (!ready) return false;

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
