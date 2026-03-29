import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/notification-sw.js').catch(() => {
      // ignore registration errors
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
