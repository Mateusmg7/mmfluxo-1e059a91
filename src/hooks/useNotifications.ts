import { useEffect, useRef } from 'react';
import { BillReminder } from './useBillReminders';

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

      urgentReminders.forEach((r) => {
        const key = `${r.id}-${new Date().toDateString()}`;
        if (notifiedIds.current.has(key)) return;
        notifiedIds.current.add(key);

        const isToday = r.dia_vencimento === today;
        const label = isToday ? 'HOJE' : 'AMANHÃ';
        const valorStr = r.valor ? ` - R$ ${r.valor.toFixed(2)}` : '';

        try {
          new Notification(`💰 Conta vence ${label}!`, {
            body: `${r.nome}${valorStr} (dia ${r.dia_vencimento})`,
            icon: '/favicon.ico',
            tag: key,
          });
        } catch {
          // Notification API may fail on mobile browsers
        }
      });
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
