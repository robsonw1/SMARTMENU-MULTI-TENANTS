import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getTenantIdSync } from '@/lib/tenant-resolver';

/**
 * Componente para injetar meta tags dinâmicas no head da página
 * - Manifest dinâmico para PWA (com logo do tenant)
 * - og:image para WhatsApp sharing
 */
export function DynamicMetaTags() {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const tenantId = getTenantIdSync();
    const storeName = settings?.name || 'Pizzaria Forneiro Eden';
    const logoUrl = settings?.store_logo_url;

    // 1️⃣  Injetar ou atualizar link do manifest dinâmico
    if (tenantId) {
      const existingManifestLink = document.querySelector('link[rel="manifest"]');
      const manifestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-manifest?tenant_id=${tenantId}`;

      if (existingManifestLink) {
        existingManifestLink.setAttribute('href', manifestUrl);
      } else {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);
      }
      console.log(`✅ [META-TAGS] Manifest dinâmico injetado: ${manifestUrl}`);
    }

    // 2️⃣  Injetar ou atualizar og:image para WhatsApp
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

    // 3️⃣  Atualizar og:title e og:description com storeName
    if (storeName) {
      const existingOgTitle = document.querySelector('meta[property="og:title"]');
      if (existingOgTitle) {
        existingOgTitle.setAttribute('content', storeName);
      }

      const existingOgDesc = document.querySelector('meta[property="og:description"]');
      if (existingOgDesc) {
        existingOgDesc.setAttribute('content', `🍕Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹`);
      }
    }
  }, [settings]);

  // Este componente não renderiza nada visualmente
  return null;
}
