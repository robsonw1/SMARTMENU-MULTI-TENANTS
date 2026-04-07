import { Header } from '@/components/Header';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ProductModal } from '@/components/ProductModal';
import { CartDrawer } from '@/components/CartDrawer';
import { CheckoutModal } from '@/components/CheckoutModal';
import { SchedulingCheckoutModal } from '@/components/SchedulingCheckoutModal';
import { Footer } from '@/components/Footer';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { DeliveryAddressDialog } from '@/components/DeliveryAddressDialog';
import { DynamicMetaTags } from '@/components/DynamicMetaTags';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useLoyaltyRealtimeSync } from '@/hooks/use-loyalty-realtime-sync';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useSettingsRealtimeSync } from '@/hooks/use-settings-realtime-sync';
import { initTenantResolver, getTenantIdSync } from '@/lib/tenant-resolver';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { useState, useEffect } from 'react';

const Index = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDeliveryAddressOpen, setIsDeliveryAddressOpen] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const restoreRememberedLogin = useLoyaltyStore((s) => s.restoreRememberedLogin);

  // ✅ Sincronizar dados em tempo real (produtos, pedidos, configurações)
  // Mas apenas se não há erro - renderizar conteúdo mesmo assim
  try {
    useRealtimeSync();
  } catch (err) {
    console.error('❌ [INDEX] Erro em useRealtimeSync:', err);
  }

  try {
    useLoyaltyRealtimeSync();
  } catch (err) {
    console.error('❌ [INDEX] Erro em useLoyaltyRealtimeSync:', err);
  }

  try {
    useSettingsRealtimeSync();
  } catch (err) {
    console.error('❌ [INDEX] Erro em useSettingsRealtimeSync:', err);
  }

  // ✅ NOVO (07/04/2026): Aguardar settings carregarem ANTES de renderizar Header (que usa useTheme)
  // Isso garante que default_theme está disponível quando useTheme ( precisar
  useEffect(() => {
    const ensureSettingsLoaded = async () => {
      const tenantId = getTenantIdSync();
      if (!tenantId) {
        console.log('⏳ [INDEX-SETTINGS] Aguardando tenant_id...');
        setTimeout(() => ensureSettingsLoaded(), 100);
        return;
      }

      try {
        const { loadSettingsFromSupabase } = useSettingsStore.getState();
        console.log('📥 [INDEX-SETTINGS] Carregando settings com AWAIT para garantir tema padrão...');
        await loadSettingsFromSupabase();
        console.log('✅ [INDEX-SETTINGS] Settings carregadas! Header pode renderizar com tema correto.');
        setSettingsReady(true);
      } catch (err) {
        console.error('❌ [INDEX-SETTINGS] Erro ao carregar settings, continuando mesmo assim:', err);
        setSettingsReady(true); // Continuar mesmo com erro
      }
    };

    ensureSettingsLoaded();
  }, []);

  // ✅ Carregar configurações de fidelização (cliente - seguro aqui)
  const { loadSettings } = useLoyaltySettingsStore();
  useEffect(() => {
    console.log('[PAGE-INIT] Carregando loyalty settings...');
    loadSettings().catch((err) => {
      console.error('❌ [PAGE-INIT] Erro ao carregar loyalty settings:', err);
      // NÃO FALHAR - Continuar mesmo com erro
    });
  }, [loadSettings]);

  // ✅ NOVO (30/03/2026): Inicializar resolver de tenant_id
  // Aqui é seguro - cliente público, sem conflito de auth
  useEffect(() => {
    console.log('🚀 [INDEX-INIT] Inicializando tenant resolver para cliente...');
    initTenantResolver().then((tenantId) => {
      if (tenantId) {
        console.log(`✅ [INDEX-INIT] Tenant resolver inicializado: ${tenantId}`);
      } else {
        console.warn('⚠️ [INDEX-INIT] Não foi possível resolver tenant_id (continuando mesmo assim)');
      }
    }).catch((err) => {
      console.error('❌ [INDEX-INIT] Erro ao inicializar tenant resolver:', err);
      // NÃO FALHAR - Continuar mesmo com erro, usuário vê "Carregando..."
    });
  }, []);

  // Restaurar login lembrado ao inicializar
  useEffect(() => {
    const restoreLogin = async () => {
      console.log('🔄 [PAGE-INIT] Tentando restaurar login lembrado...');
      const remembered = localStorage.getItem('loyalty_remembered_login');
      console.log('🔄 [PAGE-INIT] localStorage.getItem resultado:', remembered);
      
      const restored = await restoreRememberedLogin();
      if (restored) {
        console.log('✅ [PAGE-INIT] Login automático restaurado com sucesso!');
      } else {
        console.log('❌ [PAGE-INIT] Falha ao restaurar login');
      }
    };

    restoreLogin();
  }, [restoreRememberedLogin]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DynamicMetaTags />
      {/* ✅ NOVO: SÓ renderizar Header após settings carregarem (garante theme correto) */}
      {settingsReady && <Header onLoginClick={() => setIsLoginModalOpen(true)} />}
      {!settingsReady && <div className="h-16" />} {/* Placeholder para Header */}

      <main className="flex-1 w-full">
        <ProductCatalog />
      </main>

      {/* Footer */}
      <Footer
        onLoginClick={() => setIsLoginModalOpen(true)}
        onAdminClick={() => {}}
      />

      {/* Modals & Drawers */}
      <CustomerLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => setIsLoginModalOpen(false)}
        onSignupSuccess={() => {
          setIsLoginModalOpen(false);
          // Toast com ação será mostrado pelo componente
        }}
        onOpenAddressDialog={() => setIsDeliveryAddressOpen(true)}
      />
      <DeliveryAddressDialog
        isOpen={isDeliveryAddressOpen}
        onClose={() => setIsDeliveryAddressOpen(false)}
      />
      <ProductModal />
      <CartDrawer />
      <CheckoutModal />
      <SchedulingCheckoutModal />
    </div>
  );
};

export default Index;
