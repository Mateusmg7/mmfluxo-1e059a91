const NOTIFICATION_SW_URL = "/notification-sw.js";
export const NOTIFICATION_SW_SCOPE = "/notifications/";

export async function getNotificationServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration(NOTIFICATION_SW_SCOPE);
  if (existing) return existing;

  return navigator.serviceWorker.register(NOTIFICATION_SW_URL, {
    scope: NOTIFICATION_SW_SCOPE,
  });
}