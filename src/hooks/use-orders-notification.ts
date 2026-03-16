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
 * Hook para gerenciar notificação de pedidos
 * Mostra pulse AZUL quando há novo pedido ou mudança de status
 * Remove pulse quando cliente visualiza o drawer de pedidos
 * INTEGRADO com Web Push notifications
 */
export const useOrdersNotification = () => {
  const [showOrdersNotification, setShowOrdersNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastOrdersCheckRef = useRef<string>('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderStatusRef = useRef<Record<string, string>>({}); // Rastrear status anteriores
  const isFetchingRef = useRef<boolean>(false); // ✅ Prevenir múltiplas chamadas simultâneas

  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);

  /**
   * ✅ RESTAURAR ESTADO DO LOCALSTORAGE NA REMONTAGEM
   * Garante que pulse persista mesmo após remontagens do component
   */
  useEffect(() => {
    if (!currentCustomer?.id) return;

    const notificationVisibleKey = `orders_notification_visible_${currentCustomer.id}`;
    const savedVisible = localStorage.getItem(notificationVisibleKey);
    
    if (savedVisible === 'true') {
      console.log('[ORDERS-NOTIFICATION] 💾 Restaurando pulse do localStorage');
      setShowOrdersNotification(true);
    }
  }, [currentCustomer?.id]);

  /**
   * ✅ PERSISTIR ESTADO NO LOCALSTORAGE
   * Salva mudanças de showOrdersNotification para survive remontagens
   */
  useEffect(() => {
    if (!currentCustomer?.id) return;

    const notificationVisibleKey = `orders_notification_visible_${currentCustomer.id}`;
    
    if (showOrdersNotification) {
      localStorage.setItem(notificationVisibleKey, 'true');
      console.log('[ORDERS-NOTIFICATION] 💾 Pulse persistido no localStorage');
    } else {
      localStorage.removeItem(notificationVisibleKey);
      console.log('[ORDERS-NOTIFICATION] 🗑️ Pulse removido do localStorage');
    }
  }, [showOrdersNotification, currentCustomer?.id]);

  /**
   * Verifica se há pedidos novos ou com mudança de status
   */
  useEffect(() => {
    if (!currentCustomer?.email) {
      setIsLoading(false);
      return;
    }

    const fetchOrdersStatus = async () => {
      // ✅ BLOQUEADOR: Prevenir múltiplas chamadas simultâneas
      if (isFetchingRef.current) {
        console.debug('[ORDERS-NOTIFICATION] ⏭️ Fetch já em progresso, ignorando...');
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
          console.error('[ORDERS-NOTIFICATION] ❌ Erro ao buscar pedidos:', error);
          setIsLoading(false);
          isFetchingRef.current = false; // ✅ Liberar bloqueador
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

          // ✅ Inicializar ref com status salvo (para não disparar em remontagens)
          if (!lastOrderStatusRef.current[latestOrder.id] && savedStatus) {
            lastOrderStatusRef.current[latestOrder.id] = savedStatus;
          }

          // ✅ DETECTAR MUDANÇA DE STATUS
          if (lastCheck !== currentCheck) {
            const previousStatus = lastOrderStatusRef.current[latestOrder.id];
            const statusChanged = previousStatus && previousStatus !== latestOrder.status;
            const isNewOrder = !lastViewedOrderId || lastViewedOrderId !== latestOrder.id;

            // ✅ Mostrar notificação se: é novo pedido OU status mudou
            if (isNewOrder || statusChanged) {
              console.log('[ORDERS-NOTIFICATION] 🔔 Novo pedido ou status alterado detectado:', {
                orderId: latestOrder.id,
                status: latestOrder.status,
                isNew: isNewOrder,
                statusChanged,
              });
              setShowOrdersNotification(true);
              lastOrdersCheckRef.current = currentCheck;

              // 📱 Enviar push apenas se é novo pedido ou status mudou
              if (statusChanged || !previousStatus) {
                triggerPushNotification(latestOrder.id, latestOrder.status);
              }
            }

            // ✅ SEMPRE atualizar rastreamento de status para próxima comparação
            lastOrderStatusRef.current[latestOrder.id] = latestOrder.status;
            localStorage.setItem(statusStorageKey, latestOrder.status);
          }
          // ⚠️ REMOVIDO: Não desligar o pulse automaticamente
          // O pulse PERSISTE até que cliente clique em "Meus Pedidos" (markOrdersAsViewed)
        }

        setIsLoading(false);
        isFetchingRef.current = false;
      } catch (error) {
        console.error('[ORDERS-NOTIFICATION] Erro:', error);
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    };

    // 1️⃣ Fetch inicial
    fetchOrdersStatus();

    // 2️⃣ POLLING CONSTANTE: Verificar a cada 3 segundos independente de Realtime
    // Isso garante que notificações funcionem SEMPRE, Realtime ou não
    const pollingConstanteRef = setInterval(() => {
      console.log('[ORDERS-NOTIFICATION] 🔄 Poll constante (3s)...');
      fetchOrdersStatus();
    }, 3000);

    // 3️⃣ Setup realtime subscription para mudanças de pedidos (bonus para detecção mais rápida)
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
          console.log('[ORDERS-NOTIFICATION] 🔄 Novo evento de pedido via Realtime:', payload.eventType);
          // Refetch orders quando há mudança
          fetchOrdersStatus();
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[ORDERS-NOTIFICATION] ⚠️ Realtime com erro, mas polling constante está ativo');
        } else if (status === 'SUBSCRIBED') {
          console.log('[ORDERS-NOTIFICATION] ✅ Realtime conectado (polling constante também ativo)');
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
   * Remove a notificação de pulse
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
        console.error('[ORDERS-NOTIFICATION] ❌ Erro ao buscar pedido recente:', error);
        return;
      }

      const latestOrder = data[0];
      const latestOrderId = latestOrder.id;
      const storageKey = `orders_notification_${currentCustomer.id}`;
      const statusStorageKey = `orders_status_${currentCustomer.id}_${latestOrderId}`;
      
      localStorage.setItem(storageKey, latestOrderId);
      // ✅ IMPORTANTE: Guardar o STATUS ATUAL antes de limpar, para detectar próximas mudanças
      localStorage.setItem(statusStorageKey, latestOrder.status);
      lastOrderStatusRef.current[latestOrderId] = latestOrder.status;
      console.log('[ORDERS-NOTIFICATION] 💾 Status salvo ao visualizar:', {
        orderId: latestOrderId,
        status: latestOrder.status,
      });
      setShowOrdersNotification(false);
    } catch (error) {
      console.error('[ORDERS-NOTIFICATION] Erro ao marcar como visto:', error);
    }
  };

  /**
   * Força um polling super agressivo por 10 segundos
   * CHAMADO AUTOMATICAMENTE APÓS CRIAR UM PEDIDO
   * Garante detecção IMEDIATAMENTE sem depender do Realtime
   */
  const forceAggressivePolling = () => {
    // ⚠️ PROTEÇÃO: Se não há cliente logado, não fazer polling
    if (!currentCustomer?.email) {
      console.log('[ORDERS-NOTIFICATION] ℹ️ Polling supress - cliente não logado');
      return;
    }

    console.log('[ORDERS-NOTIFICATION] ⚡ INICIANDO POLLING AGRESSIVO (1s/10s)');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll a cada 1 segundo por 10 segundos
    let pollCount = 0;
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      console.log(`[ORDERS-NOTIFICATION] ⚡ Poll agressivo ${pollCount}/10...`);
      
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

            // Se encontrou pedido novo → ativar pulse IMEDIATAMENTE
            if (lastViewedOrderId !== latestOrder.id) {
              console.log('[ORDERS-NOTIFICATION] 🎯 NOVO PEDIDO DETECTADO! ⚡', {
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

      // Parar após 10 segundos
      if (pollCount >= 10) {
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        console.log('[ORDERS-NOTIFICATION] ✅ Polling agressivo finalizado');
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
   * Não interfere com o fluxo de UI realtime
   */
  const triggerPushNotification = (orderId: string, status: string) => {
    // Fila em microtask para não bloquear
    queueMicrotask(async () => {
      if (!currentCustomer?.email) return;

      try {
        console.log('[ORDERS-NOTIFICATION] � Enviando push:', { orderId, status });

        const { error } = await (supabase as any).functions.invoke(
          'send-push-notification',
          {
            body: {
              orderId,
              status,
              email: currentCustomer.email,
              customerName: currentCustomer.name || 'Cliente',
            },
          }
        );

        if (error) {
          console.warn('[ORDERS-NOTIFICATION] ⚠️ Erro no push:', error);
        } else {
          console.log('[ORDERS-NOTIFICATION] ✅ Push enviado');
        }
      } catch (err) {
        console.error('[ORDERS-NOTIFICATION] ❌ Erro ao enviar push:', err);
      }
    });
  };

  return {
    showOrdersNotification,
    isLoading,
    markOrdersAsViewed,
    resetOrdersNotification,
    forceAggressivePolling, // 🔴 NOVA FUNÇÃO para detectar pedidos em tempo real
  };
};
