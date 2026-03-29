import { useEffect, useRef } from 'react';
import { BillReminder } from './useBillReminders';

async function showSystemNotification(title: string, options: NotificationOptions) {
  if (!('Notification' in window)) return false;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, options);
      return true;
    }
  } catch {
    // Notification API may fail on mobile browsers
  }

  return false;
}

const NINE_HOURS_MS = 9 * 60 * 60 * 1000;

export function useNotifications(urgentReminders: BillReminder[]) {
  const lastNotifiedAt = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!urgentReminders.length) return;
    if (!('Notification' in window)) return;

    const sendNotifications = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      const now = Date.now();
      // Skip if last batch was sent less than 9 hours ago
      if (lastNotifiedAt.current && now - lastNotifiedAt.current < NINE_HOURS_MS) return;
      lastNotifiedAt.current = now;

      const today = new Date().getDate();

      for (const r of urgentReminders) {
        const isToday = r.dia_vencimento === today;
        const label = isToday ? 'Conta vencendo hoje' : 'Conta vencendo amanhã';
        const valorStr = r.valor ? ` - R$ ${r.valor.toFixed(2)}` : '';

        await showSystemNotification(`💰 ${label}`, {
          body: `${r.nome}${valorStr} (dia ${r.dia_vencimento})`,
          icon: '/favicon.ico',
          tag: `${r.id}-${now}`,
        });
      }
    };

    // Send immediately on first load
    sendNotifications();

    // Re-send every 9 hours
    intervalRef.current = setInterval(sendNotifications, NINE_HOURS_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [urgentReminders]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function sendTestNotification(reminder: BillReminder): Promise<boolean> {
  const today = new Date().getDate();
  const isToday = reminder.dia_vencimento === today;
  const tomorrow = new Date(Date.now() + 86400000).getDate();
  const isTomorrow = reminder.dia_vencimento === tomorrow;
  const label = isToday ? 'Conta vencendo hoje' : isTomorrow ? 'Conta vencendo amanhã' : `Conta vence dia ${reminder.dia_vencimento}`;
  const valorStr = reminder.valor ? ` - R$ ${reminder.valor.toFixed(2)}` : '';

  return showSystemNotification(`💰 ${label}`, {
    body: `${reminder.nome}${valorStr}`,
    icon: '/favicon.ico',
    tag: `test-${reminder.id}-${Date.now()}`,
  });
}
