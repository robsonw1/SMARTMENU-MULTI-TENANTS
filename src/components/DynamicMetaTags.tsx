import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Componente para injetar meta tags dinâmicas no head da página
 * - og:image para WhatsApp sharing (com logo customizado do tenant)
 * - og:title e og:description customizados
 * 
 * ✅ NOTA: Manifest dinâmico é agora handle pelo Service Worker (public/service-worker.js)
 * Não injetamos mais o link manifest aqui para evitar conflitos!
 */
export function DynamicMetaTags() {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const storeName = settings?.name || 'Faça seu pedido agora';
    const logoUrl = settings?.store_logo_url;

    // 1️⃣  Atualizar og:image para WhatsApp sharing (com logo customizado)
    if (logoUrl) {
      const existingOgImage = document.querySelector('meta[property="og:image"]');
      
      if (existingOgImage) {
        existingOgImage.setAttribute('content', logoUrl);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        meta.setAttribute('content', logoUrl);
        document.head.appendChild(meta);
      }

      // Também atualizar og:image:width e og:image:height se existirem
      let ogImageWidth = document.querySelector('meta[property="og:image:width"]');
      if (!ogImageWidth) {
        ogImageWidth = document.createElement('meta');
        ogImageWidth.setAttribute('property', 'og:image:width');
        ogImageWidth.setAttribute('content', '512');
        document.head.appendChild(ogImageWidth);
      }

      let ogImageHeight = document.querySelector('meta[property="og:image:height"]');
      if (!ogImageHeight) {
        ogImageHeight = document.createElement('meta');
        ogImageHeight.setAttribute('property', 'og:image:height');
        ogImageHeight.setAttribute('content', '512');
        document.head.appendChild(ogImageHeight);
      }

      console.log(`✅ [META-TAGS] og:image injetado: ${logoUrl}`);
    }

    // 2️⃣  Atualizar og:title e og:description com storeName
    if (storeName) {
      const existingOgTitle = document.querySelector('meta[property="og:title"]');
      if (existingOgTitle) {
        existingOgTitle.setAttribute('content', storeName);
      }

      const existingOgDesc = document.querySelector('meta[property="og:description"]');
      if (existingOgDesc) {
        existingOgDesc.setAttribute('content', `�Economize! Ganhe Cashback a cada Real gasto`);
      }
    }
  }, [settings]);

  // Este componente não renderiza nada visualmente
  return null;
}
