import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Carrega ferramentas de diagnóstico (disponível em window.__diagnosticSettings)
import "./lib/diagnostic-settings.ts";

// Registrar Service Worker para PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((registration) => {
        console.log("[SW] ✅ Service Worker registrado com sucesso:", registration.scope);
      })
      .catch((error) => {
        console.warn("[SW] ❌ Erro ao registrar Service Worker:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
