import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { getNotificationServiceWorkerRegistration, NOTIFICATION_SW_SCOPE } from "@/lib/notificationServiceWorker";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("-preview--") ||
  window.location.hostname.includes("lovable.app") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Keep the notification worker to allow local/test notifications in preview
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => {
      const isNotificationWorker = r.scope.endsWith(NOTIFICATION_SW_SCOPE);
      if (!isNotificationWorker) {
        r.unregister();
      }
    })
  );

  window.addEventListener("load", () => {
    getNotificationServiceWorkerRegistration().catch(() => {});
  });
} else if ("serviceWorker" in navigator) {
  // Register PWA SW with prompt mode but forcing update
  registerSW({
    onNeedRefresh() {
      console.log('Nova versão detectada! Recarregando imediatamente...');
      window.location.reload();
    },
    onOfflineReady() {
      console.log('App pronto para uso offline');
    },
  });

  // Force update check on every load/focus
  window.addEventListener('focus', () => {
    navigator.serviceWorker?.getRegistration().then(reg => reg?.update());
  });

  // Also register notification SW
  window.addEventListener("load", () => {
    getNotificationServiceWorkerRegistration().catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
