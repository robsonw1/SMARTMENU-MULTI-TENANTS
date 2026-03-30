import { Header } from '@/components/Header';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ProductModal } from '@/components/ProductModal';
import { CartDrawer } from '@/components/CartDrawer';
import { CheckoutModal } from '@/components/CheckoutModal';
import { SchedulingCheckoutModal } from '@/components/SchedulingCheckoutModal';
import { Footer } from '@/components/Footer';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { DeliveryAddressDialog } from '@/components/DeliveryAddressDialog';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { useLoyaltyRealtimeSync } from '@/hooks/use-loyalty-realtime-sync';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useSettingsRealtimeSync } from '@/hooks/use-settings-realtime-sync';
import { initTenantResolver } from '@/lib/tenant-resolver';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { useState, useEffect } from 'react';

const Index = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDeliveryAddressOpen, setIsDeliveryAddressOpen] = useState(false);
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const restoreRememberedLogin = useLoyaltyStore((s) => s.restoreRememberedLogin);

  // ✅ Sincronizar dados em tempo real (produtos, pedidos, configurações)
  useRealtimeSync();
  useLoyaltyRealtimeSync();
  useSettingsRealtimeSync();

  // ✅ Carregar configurações de fidelização (cliente - seguro aqui)
  const { loadSettings } = useLoyaltySettingsStore();
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ✅ NOVO (30/03/2026): Inicializar resolver de tenant_id
  // Aqui é seguro - cliente público, sem conflito de auth
  useEffect(() => {
    console.log('🚀 [INDEX-INIT] Inicializando tenant resolver para cliente...');
    initTenantResolver().then((tenantId) => {
      if (tenantId) {
        console.log(`✅ [INDEX-INIT] Tenant resolver inicializado: ${tenantId}`);
      } else {
        console.warn('⚠️ [INDEX-INIT] Não foi possível resolver tenant_id');
      }
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
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      <main className="flex-1">
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
