import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { getNotificationServiceWorkerRegistration, NOTIFICATION_SW_SCOPE } from "@/lib/notificationServiceWorker";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
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
  // Register PWA service worker (prompt update, no auto-reload)
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Silently update without reloading
      updateSW(true);
    },
  });

  // Also register notification SW
  window.addEventListener("load", () => {
    getNotificationServiceWorkerRegistration().catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
