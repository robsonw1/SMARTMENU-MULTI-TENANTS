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
        
        // ✅ Verificar atualizações a cada 30 segundos (força atualização rápida)
        setInterval(() => {
          registration.update().catch(error => {
            console.warn('[SW] Erro ao verificar atualizações:', error);
          });
        }, 30000);
      })
      .catch((error) => {
        console.warn("[SW] ❌ Erro ao registrar Service Worker:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
