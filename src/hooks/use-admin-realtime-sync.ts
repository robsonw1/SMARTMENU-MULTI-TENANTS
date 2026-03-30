import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrdersStore } from '@/store/useOrdersStore';
import { getTenantIdSync } from '@/lib/tenant-resolver';

/**
 * ✅ NOVO HOOK - Sincronização de Tempo Real para Admins (THREAD-SAFE)
 * 
 * PROPÓSITO: Garantir que admins vejam apenas SEUS pedidos em tempo real
 * sem conflito com outros tenants.
 * 
 * SEGURANÇA:
 * 1. ✅ Valida tenant_id ANTES de sincronizar
 * 2. ✅ RLS no banco garante que query retorna APENAS seus pedidos
 * 3. ✅ Não sincroniza se tenant_id vazio
 * 4. ✅ Fallback para polling se realtime falhar
 * 
 * NOTA: Este hook é chamado DENTRO de AdminDashboard (contextualmente seguro)
 */
export const useAdminRealtimeSync = () => {
  useEffect(() => {
    // ✅ Obter tenant_id do cache (já validado em useAdminAuth)
    const tenantId = sessionStorage.getItem('sb-auth-tenant-id');
    
    if (!tenantId) {
      console.log('ℹ️ [ADMIN-SYNC] tenant_id não disponível - sync desativado');
      return;
    }

    console.log(`✅ [ADMIN-SYNC] Iniciando sincronização em tempo real para tenant: ${tenantId}`);

    let isMounted = true;
    let realtimeReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const syncOrdersFromSupabase = async () => {
      if (!isMounted) return;
      try {
        const ordersStore = useOrdersStore.getState();
        await ordersStore.syncOrdersFromSupabase();
      } catch (error) {
        console.error(`❌ [ADMIN-SYNC] Erro ao sincronizar pedidos (tenant: ${tenantId}):`, error);
      }
    };

    // 🔔 REALTIME: Escutar mudanças em orders (RLS filtra por tenant_id automaticamente)
    const ordersChannel = supabase
      .channel(`admin:orders:${tenantId}:realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (!isMounted) return;
          console.log(`🔔 [ADMIN-SYNC] Evento Realtime recebido (tenant: ${tenantId}):`, {
            event: payload.eventType,
            orderId: payload.new?.id || payload.old?.id,
            tenantId: payload.new?.tenant_id || payload.old?.tenant_id,
          });
          syncOrdersFromSupabase();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [ADMIN-SYNC] Realtime SUBSCRIBED para tenant: ${tenantId}`);
          realtimeReconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.warn(`⚠️ [ADMIN-SYNC] Realtime desconectado (tenant: ${tenantId}):`, status);
          
          // Tentativa automática de reconexão
          if (realtimeReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            realtimeReconnectAttempts++;
            console.log(`⏳ [ADMIN-SYNC] Tentando reconectar (${realtimeReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
              if (isMounted) {
                ordersChannel.subscribe();
              }
            }, 2000 * realtimeReconnectAttempts);
          }
        }
      });

    // ⏰ POLLING FALLBACK: A cada 5 segundos como segurança
    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      syncOrdersFromSupabase();
    }, 5000);

    console.log(`📡 [ADMIN-SYNC] Sincronização configurada para tenant: ${tenantId}`);

    // Cleanup
    return () => {
      isMounted = false;
      console.log(`🛑 [ADMIN-SYNC] Finalizando sincronização do tenant: ${tenantId}`);
      clearInterval(pollInterval);
      ordersChannel.unsubscribe();
    };
  }, []);
};
