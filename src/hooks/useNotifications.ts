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

export function useNotifications(urgentReminders: BillReminder[]) {
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!urgentReminders.length) return;
    if (!('Notification' in window)) return;

    const sendNotifications = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      const today = new Date().getDate();

      for (const r of urgentReminders) {
        const key = `${r.id}-${new Date().toDateString()}`;
        if (notifiedIds.current.has(key)) continue;
        notifiedIds.current.add(key);

        const isToday = r.dia_vencimento === today;
        const label = isToday ? 'HOJE' : 'AMANHÃ';
        const valorStr = r.valor ? ` - R$ ${r.valor.toFixed(2)}` : '';

        await showSystemNotification(`💰 Conta vence ${label}!`, {
          body: `${r.nome}${valorStr} (dia ${r.dia_vencimento})`,
          icon: '/favicon.ico',
          tag: key,
        });
      }
    };

    sendNotifications();
  }, [urgentReminders]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function sendTestNotification(reminder: BillReminder): Promise<boolean> {
  const valorStr = reminder.valor ? ` - R$ ${reminder.valor.toFixed(2)}` : '';

  return showSystemNotification(`💰 Teste: ${reminder.nome}`, {
    body: `${reminder.nome}${valorStr} (dia ${reminder.dia_vencimento})`,
    icon: '/favicon.ico',
    tag: `test-${reminder.id}-${Date.now()}`,
  });
}
