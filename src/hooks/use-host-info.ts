import { useMemo } from 'react';

type HostType = 'admin' | 'landing' | 'tenant';

export const useHostInfo = (): { type: HostType; tenantSlug?: string } => {
  return useMemo(() => {
    const hostname = window.location.hostname;

    console.log('🔍 useHostInfo detecting:', hostname);

    // admin-app.aezap.site → Admin global (gerencia todos os estabelecimentos)
    if (hostname.includes('admin-app')) {
      console.log('✅ Detected: admin');
      return { type: 'admin' };
    }

    // app.aezap.site → Landing pública (sem tenant específico)
    if (hostname === 'app.aezap.site' || hostname === 'localhost' || hostname === 'localhost:5173' || hostname === 'localhost:3001') {
      console.log('✅ Detected: landing');
      return { type: 'landing' };
    }

    // {tenant-slug}.app.aezap.site → App do cliente
    // Ex: smartmenu.app.aezap.site
    if (hostname.includes('.app.aezap.site') && !hostname.includes('admin-app')) {
      const parts = hostname.split('.');
      const slug = parts[0]; // smartmenu.app.aezap.site → smartmenu
      console.log('✅ Detected: tenant -', slug);
      return { type: 'tenant', tenantSlug: slug };
    }

    // Fallback
    console.log('✅ Detected: landing (fallback)');
    return { type: 'landing' };
  }, []);
};
