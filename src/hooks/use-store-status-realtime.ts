import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSecureTenantId } from '@/hooks/use-secure-tenant-id';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que monitora APENAS isManuallyOpen em tempo real enquanto checkout aberto
 * CRÍTICO: Sincroniza mudanças de "Abrir/Fechar Loja" instantaneamente
 */
export function useStoreStatusRealtime(isCheckoutOpen: boolean) {
  const { tenantId } = useSecureTenantId();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    if (!isCheckoutOpen || !tenantId) return;

    let isSubscribed = true;
    let channel: any = null;

    console.log('🛍️ [CHECKOUT-REALTIME] ⚡ INICIANDO monitoramento isManuallyOpen', { tenantId });

    const settingsId = `settings_${tenantId}`;
    const setupRealtimeSync = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('id', settingsId)
          .eq('tenant_id', tenantId)
          .single();

        if (!error && data && isSubscribed) {
          const settingsData = data as any;
          const valueJson = settingsData.value || {};
          console.log('🛍️ [CHECKOUT-REALTIME] isManuallyOpen ATUAL:', valueJson.isManuallyOpen);

          await updateSettings({
            isManuallyOpen: valueJson.isManuallyOpen ?? true,
          });
        }
      } catch (error) {
        console.error('❌ [CHECKOUT-REALTIME] Erro:', error);
      }
    };

    setupRealtimeSync();

    channel = supabase
      .channel(`checkout-status-${tenantId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: `id=eq.${settingsId}`,
        },
        async (payload: any) => {
          if (!isSubscribed) return;

          const newData = payload.new as any;
          const newValueJson = newData.value || {};

          console.log('⚡⚡⚡ [CHECKOUT-REALTIME] MUDANÇA DETECTADA ⚡⚡⚡');
          console.log('🔴 [CHECKOUT-REALTIME] NOVO isManuallyOpen:', newValueJson.isManuallyOpen);

          await updateSettings({
            isManuallyOpen: newValueJson.isManuallyOpen ?? true,
          });

          console.log('✅✅✅ [CHECKOUT-REALTIME] isManuallyOpen SINCRONIZADO ✅✅✅');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [CHECKOUT-REALTIME] Monitorando isManuallyOpen');
        }
      });

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isCheckoutOpen, tenantId]);
}
