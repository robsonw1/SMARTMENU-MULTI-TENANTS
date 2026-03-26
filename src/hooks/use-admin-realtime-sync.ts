import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrdersStore } from '@/store/useOrdersStore';

/**
 * ✅ NOVO HOOK - Sincronização de Tempo Real para Admins
 * 
 * PROPÓSITO: Garantir que TODOS os admins conectados vejam os pedidos
 * em tempo real, independente de qual navegador/aba eles estejam usando.
 * 
 * FUNCIONALIDADES:
 * 1. Verifica se user é admin via localStorage token
 * 2. Configura realtime subscription para tabela orders
 * 3. Fallback: Polling a cada 5s se realtime falhar
 * 4. Sincronização automática ao detectar mudanças
 * 5. Logs detalhados para debugging multi-admin
 * 
 * NOTA: Este hook é chamado GLOBALMENTE em App.tsx para todos os admins
 */
export const useAdminRealtimeSync = () => {
  useEffect(() => {
    // ✅ Verificar se é admin (tem token no localStorage)
    const isAdmin = !!localStorage.getItem('admin-token');
    if (!isAdmin) {
      console.log('ℹ️ [ADMIN-SYNC] User não é admin - sync desativado');
      return;
    }

    console.log('✅ [ADMIN-SYNC] Admin detectado - iniciando sincronização em tempo real');

    let isMounted = true;
    let realtimeReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const syncOrdersFromSupabase = async () => {
      if (!isMounted) return;
      try {
        const ordersStore = useOrdersStore.getState();
        await ordersStore.syncOrdersFromSupabase();
      } catch (error) {
        console.error('❌ [ADMIN-SYNC] Erro ao sincronizar pedidos:', error);
      }
    };

    // 🔔 REALTIME: Escutar mudanças em orders
    const ordersChannel = supabase
      .channel('admin:orders:realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (!isMounted) return;
          console.log('🔔 [ADMIN-SYNC] Evento Realtime recebido:', payload.eventType, 'Order:', payload.new?.id || payload.old?.id);
          syncOrdersFromSupabase();
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [ADMIN-SYNC] Realtime SUBSCRIBED - ouvindo mudanças de pedidos');
          realtimeReconnectAttempts = 0; // Reset counter
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.warn('⚠️ [ADMIN-SYNC] Realtime desconectado:', status, error?.message);
          
          // Tentativa automática de reconexão
          if (realtimeReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            realtimeReconnectAttempts++;
            console.log(`⏳ [ADMIN-SYNC] Tentando reconectar (${realtimeReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
              if (isMounted) {
                ordersChannel.subscribe();
              }
            }, 2000 * realtimeReconnectAttempts); // Exponential backoff
          } else {
            console.error('❌ [ADMIN-SYNC] Máximo de reconexões atingido - usando polling como fallback');
          }
        }
      });

    // ⏰ POLLING FALLBACK: A cada 5 segundos como garantia
    // Isso funciona como rede de segurança se realtime falhar
    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      syncOrdersFromSupabase();
    }, 5000);

    console.log('📡 [ADMIN-SYNC] Sincronização configurada (realtime + polling)');

    // Cleanup
    return () => {
      isMounted = false;
      console.log('🛑 [ADMIN-SYNC] Finalizando sincronização de admin');
      clearInterval(pollInterval);
      ordersChannel.unsubscribe();
    };
  }, []);
};
