/**
 * Hook que detecta dinamicamente a URL do app baseado no subdomínio
 * 
 * ✅ MULTI-TENANT: Cada estabelecimento tem sua URL própria
 * - smartmenu.app.aezap.site → https://smartmenu.app.aezap.site
 * - pizzaria-gourmet.app.aezap.site → https://pizzaria-gourmet.app.aezap.site
 * 
 * ❌ Não usa VITE_APP_URL (URL fixa) - isso quebrava quando havia múltiplos tenants
 * ✅ Detecta dinamicamente pela hostname
 */

export function useAppUrl(): string {
  try {
    const hostname = window.location.hostname;
    
    // Padrão: {slug}.app.aezap.site
    const match = hostname.match(/^([a-z0-9-]+)\.app\.aezap\.site$/i);
    
    if (match && match[1]) {
      const slug = match[1].toLowerCase();
      const appUrl = `https://${slug}.app.aezap.site`;
      console.log(`✅ [APP-URL] Detectado: ${appUrl}`);
      return appUrl;
    }
    
    // Fallback: localhost, ou outros ambientes
    console.log(`ℹ️ [APP-URL] Usando window.location.origin: ${window.location.origin}`);
    return window.location.origin;
  } catch (error) {
    console.error(`❌ [APP-URL] Erro ao detectar URL:`, error);
    return window.location.origin;
  }
}
