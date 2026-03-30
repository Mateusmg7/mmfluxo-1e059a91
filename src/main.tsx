import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Unregister all service workers in preview/iframe
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
} else if ("serviceWorker" in navigator) {
  // Register PWA service worker (auto-update)
  registerSW({ immediate: true });

  // Also register notification SW
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/notification-sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
