import { useBillReminders } from '@/hooks/useBillReminders';
import { useNotifications } from '@/hooks/useNotifications';

export default function AlertBadge() {
  const { urgentReminders } = useBillReminders();
  useNotifications(urgentReminders);

  if (urgentReminders.length === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
      {urgentReminders.length}
    </span>
  );
}
