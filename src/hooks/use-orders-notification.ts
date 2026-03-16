import { useState, useEffect, useRef } from 'react';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { supabase } from '@/integrations/supabase/client';

interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

/**
 * Hook para gerenciar notificaÃ§Ã£o de pedidos
 * Mostra pulse AZUL quando hÃ¡ novo pedido ou mudanÃ§a de status
 * Remove pulse quando cliente visualiza o drawer de pedidos
 * INTEGRADO com Web Push notifications
 */
export const useOrdersNotification = () => {
  const [showOrdersNotification, setShowOrdersNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastOrdersCheckRef = useRef<string>('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderStatusRef = useRef<Record<string, string>>({}); // Rastrear status anteriores
  const isFetchingRef = useRef<boolean>(false); // âœ… Prevenir mÃºltiplas chamadas simultÃ¢neas

  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);

  /**
   * âœ… RESTAURAR ESTADO DO LOCALSTORAGE NA REMONTAGEM
   * Garante que pulse persista mesmo apÃ³s remontagens do component
   */
  useEffect(() => {
    if (!currentCustomer?.id) return;

    const notificationVisibleKey = `orders_notification_visible_${currentCustomer.id}`;
    const savedVisible = localStorage.getItem(notificationVisibleKey);
    
    if (savedVisible === 'true') {
      console.log('[ORDERS-NOTIFICATION] ðŸ’¾ Restaurando pulse do localStorage');
      setShowOrdersNotification(true);
    }
  }, [currentCustomer?.id]);

  /**
   * âœ… PERSISTIR ESTADO NO LOCALSTORAGE
   * Salva mudanÃ§as de showOrdersNotification para survive remontagens
   */
  useEffect(() => {
    if (!currentCustomer?.id) return;

    const notificationVisibleKey = `orders_notification_visible_${currentCustomer.id}`;
    
    if (showOrdersNotification) {
      localStorage.setItem(notificationVisibleKey, 'true');
      console.log('[ORDERS-NOTIFICATION] ðŸ’¾ Pulse persistido no localStorage');
    } else {
      localStorage.removeItem(notificationVisibleKey);
      console.log('[ORDERS-NOTIFICATION] ðŸ—‘ï¸ Pulse removido do localStorage');
    }
  }, [showOrdersNotification, currentCustomer?.id]);

  /**
   * Verifica se hÃ¡ pedidos novos ou com mudanÃ§a de status
   */
  useEffect(() => {
    if (!currentCustomer?.email) {
      setIsLoading(false);
      return;
    }

    const fetchOrdersStatus = async () => {
      // âœ… BLOQUEADOR: Prevenir mÃºltiplas chamadas simultÃ¢neas
      if (isFetchingRef.current) {
        console.debug('[ORDERS-NOTIFICATION] â­ï¸ Fetch jÃ¡ em progresso, ignorando...');
        return;
      }

      isFetchingRef.current = true;

      try {
        const { data, error } = await (supabase as any)
          .from('orders')
          .select('id, status, created_at')
          .eq('email', currentCustomer.email)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[ORDERS-NOTIFICATION] âŒ Erro ao buscar pedidos:', error);
          setIsLoading(false);
          isFetchingRef.current = false; // âœ… Liberar bloqueador
          return;
        }

        if (data && data.length > 0) {
          const latestOrder = data[0];
          const storageKey = `orders_notification_${currentCustomer.id}`;
          const statusStorageKey = `orders_status_${currentCustomer.id}_${latestOrder.id}`;
          const lastViewedOrderId = localStorage.getItem(storageKey);
          const savedStatus = localStorage.getItem(statusStorageKey);
          const lastCheck = lastOrdersCheckRef.current;
          const currentCheck = `${latestOrder.id}_${latestOrder.status}`;

          // âœ… Inicializar ref com status salvo (para nÃ£o disparar em remontagens)
          if (!lastOrderStatusRef.current[latestOrder.id] && savedStatus) {
            lastOrderStatusRef.current[latestOrder.id] = savedStatus;
          }

          // âœ… DETECTAR MUDANÃ‡A DE STATUS
          if (lastCheck !== currentCheck) {
            const previousStatus = lastOrderStatusRef.current[latestOrder.id];
            const statusChanged = previousStatus && previousStatus !== latestOrder.status;
            const isNewOrder = !lastViewedOrderId || lastViewedOrderId !== latestOrder.id;

            // âœ… Mostrar notificaÃ§Ã£o se: Ã© novo pedido OU status mudou
            if (isNewOrder || statusChanged) {
              console.log('[ORDERS-NOTIFICATION] ðŸ”” Novo pedido ou status alterado detectado:', {
                orderId: latestOrder.id,
                status: latestOrder.status,
                isNew: isNewOrder,
                statusChanged,
              });
              setShowOrdersNotification(true);
              lastOrdersCheckRef.current = currentCheck;
            }

            // âœ… SEMPRE atualizar rastreamento de status para prÃ³xima comparaÃ§Ã£o
            lastOrderStatusRef.current[latestOrder.id] = latestOrder.status;
            localStorage.setItem(statusStorageKey, latestOrder.status);
          }
          // âš ï¸ REMOVIDO: NÃ£o desligar o pulse automaticamente
          // O pulse PERSISTE atÃ© que cliente clique em "Meus Pedidos" (markOrdersAsViewed)
        }

        setIsLoading(false);
        isFetchingRef.current = false;
      } catch (error) {
        console.error('[ORDERS-NOTIFICATION] Erro:', error);
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    };

    // 1ï¸âƒ£ Fetch inicial
    fetchOrdersStatus();

    // 2ï¸âƒ£ POLLING CONSTANTE: Verificar a cada 3 segundos independente de Realtime
    // Isso garante que notificaÃ§Ãµes funcionem SEMPRE, Realtime ou nÃ£o
    const pollingConstanteRef = setInterval(() => {
      console.log('[ORDERS-NOTIFICATION] ðŸ”„ Poll constante (3s)...');
      fetchOrdersStatus();
    }, 3000);

    // 3ï¸âƒ£ Setup realtime subscription para mudanÃ§as de pedidos (bonus para detecÃ§Ã£o mais rÃ¡pida)
    const channel = (supabase as any)
      .channel(`orders:${currentCustomer.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `email=eq.${currentCustomer.email}`,
        },
        (payload: any) => {
          console.log('[ORDERS-NOTIFICATION] ðŸ”„ Novo evento de pedido via Realtime:', payload.eventType);
          // Refetch orders quando hÃ¡ mudanÃ§a
          fetchOrdersStatus();
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[ORDERS-NOTIFICATION] âš ï¸ Realtime com erro, mas polling constante estÃ¡ ativo');
        } else if (status === 'SUBSCRIBED') {
          console.log('[ORDERS-NOTIFICATION] âœ… Realtime conectado (polling constante tambÃ©m ativo)');
        }
      });

    return () => {
      // Limpar polling constante
      clearInterval(pollingConstanteRef);
      
      if (channel) {
        (supabase as any).removeChannel(channel);
      }
      // Limpar polling de fallback se estiver ativo
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentCustomer?.email, currentCustomer?.id]);

  /**
   * Marca que cliente visualizou os pedidos
   * Remove a notificaÃ§Ã£o de pulse
   * Chamado quando drawer de pedidos abre
   */
  const markOrdersAsViewed = async () => {
    if (!currentCustomer?.email || !currentCustomer?.id) return;

    try {
      // Buscar o pedido mais recente
      const { data, error } = await (supabase as any)
        .from('orders')
        .select('id, status')
        .eq('email', currentCustomer.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        console.error('[ORDERS-NOTIFICATION] âŒ Erro ao buscar pedido recente:', error);
        return;
      }

      const latestOrder = data[0];
      const latestOrderId = latestOrder.id;
      const storageKey = `orders_notification_${currentCustomer.id}`;
      const statusStorageKey = `orders_status_${currentCustomer.id}_${latestOrderId}`;
      
      localStorage.setItem(storageKey, latestOrderId);
      // âœ… IMPORTANTE: Guardar o STATUS ATUAL antes de limpar, para detectar prÃ³ximas mudanÃ§as
      localStorage.setItem(statusStorageKey, latestOrder.status);
      lastOrderStatusRef.current[latestOrderId] = latestOrder.status;
      console.log('[ORDERS-NOTIFICATION] ðŸ’¾ Status salvo ao visualizar:', {
        orderId: latestOrderId,
        status: latestOrder.status,
      });
      setShowOrdersNotification(false);
    } catch (error) {
      console.error('[ORDERS-NOTIFICATION] Erro ao marcar como visto:', error);
    }
  };

  /**
   * ForÃ§a um polling super agressivo por 10 segundos
   * CHAMADO AUTOMATICAMENTE APÃ“S CRIAR UM PEDIDO
   * Garante detecÃ§Ã£o IMEDIATAMENTE sem depender do Realtime
   */
  const forceAggressivePolling = () => {
    // âš ï¸ PROTEÃ‡ÃƒO: Se nÃ£o hÃ¡ cliente logado, nÃ£o fazer polling
    if (!currentCustomer?.email) {
      console.log('[ORDERS-NOTIFICATION] â„¹ï¸ Polling supress - cliente nÃ£o logado');
      return;
    }

    console.log('[ORDERS-NOTIFICATION] âš¡ INICIANDO POLLING AGRESSIVO (1s/10s)');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll a cada 1 segundo por 10 segundos
    let pollCount = 0;
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      console.log(`[ORDERS-NOTIFICATION] âš¡ Poll agressivo ${pollCount}/10...`);
      
      // Fetch manual para verificar novo pedido
      if (currentCustomer?.email) {
        try {
          const { data } = await (supabase as any)
            .from('orders')
            .select('id, status, created_at')
            .eq('email', currentCustomer.email)
            .order('created_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const latestOrder = data[0];
            const storageKey = `orders_notification_${currentCustomer.id}`;
            const lastViewedOrderId = localStorage.getItem(storageKey);

            // Se encontrou pedido novo â†’ ativar pulse IMEDIATAMENTE
            if (lastViewedOrderId !== latestOrder.id) {
              console.log('[ORDERS-NOTIFICATION] ðŸŽ¯ NOVO PEDIDO DETECTADO! âš¡', {
                orderId: latestOrder.id,
                status: latestOrder.status,
              });
              setShowOrdersNotification(true);
              lastOrdersCheckRef.current = `${latestOrder.id}_${latestOrder.status}`;
            }
          }
        } catch (error) {
          console.error('[ORDERS-NOTIFICATION] Erro no polling agressivo:', error);
        }
      }

      // Parar apÃ³s 10 segundos
      if (pollCount >= 10) {
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        console.log('[ORDERS-NOTIFICATION] âœ… Polling agressivo finalizado');
      }
    }, 1000); // 1000ms = 1 segundo
  };

  // Resetar para testes/dev
  const resetOrdersNotification = async () => {
    if (!currentCustomer?.id) return;

    const storageKey = `orders_notification_${currentCustomer.id}`;
    localStorage.removeItem(storageKey);
    lastOrdersCheckRef.current = '';
    setShowOrdersNotification(true);
  };

  /**
   * Enviar push notification de forma async/non-blocking
   * NÃ£o interfere com o fluxo de UI realtime
   */
  return {
    showOrdersNotification,
    isLoading,
    markOrdersAsViewed,
    resetOrdersNotification,
    forceAggressivePolling, // ðŸ”´ NOVA FUNÃ‡ÃƒO para detectar pedidos em tempo real
  };
};

