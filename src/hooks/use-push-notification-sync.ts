import { useEffect, useRef } from 'react';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para enviar Web Push notifications quando status de pedido muda
 * Executa de forma independente do realtime, sem bloquear updates
 * Sincroniza com push_subscriptions via Edge Function
 */
export const usePushNotificationSync = () => {
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const lastOrderStatusRef = useRef<Record<string, string>>({});
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentCustomer?.email) return;

    // Função que monitora mudanças de status E envia push
    const syncPushNotifications = async () => {
      try {
        // Buscar pedido mais recente
        const { data, error } = await (supabase as any)
          .from('orders')
          .select('id, status, created_at')
          .eq('email', currentCustomer.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.warn('[PUSH-SYNC] ⚠️ Erro na query:', error.message);
          return;
        }

        if (!data) return;

        const latestOrder = data;
        const previousStatus = lastOrderStatusRef.current[latestOrder.id];

        // Se status mudou, enviar push via Edge Function
        if (previousStatus && previousStatus !== latestOrder.status) {
          console.log('[PUSH-SYNC] 📱 Status mudou, enviando notificação:', {
            orderId: latestOrder.id,
            from: previousStatus,
            to: latestOrder.status,
          });

          // Chamar Edge Function de forma assíncrona (fire-and-forget)
          sendPushAsync(latestOrder.id, latestOrder.status, currentCustomer);
        }

        // Atualizar rastreamento
        lastOrderStatusRef.current[latestOrder.id] = latestOrder.status;
      } catch (error) {
        console.error('[PUSH-SYNC] ⚠️ Erro ao sincronizar push:', error);
      }
    };

    // Executar sync a cada 3 segundos (menos agressivo que polling de UI)
    syncIntervalRef.current = setInterval(syncPushNotifications, 3000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [currentCustomer?.email, currentCustomer?.id]);

  return null; // Hook de efeito colateral, sem return
};

/**
 * Enviar push de forma não-bloqueante via Edge Function
 */
async function sendPushAsync(
  orderId: string,
  status: string,
  currentCustomer: any
) {
  // Colocar em microtask para não bloquear
  queueMicrotask(async () => {
    try {
      if (!currentCustomer?.email) return;

      console.log('[PUSH-SYNC] 🚀 Enviando push via Edge Function...');

      const { error } = await (supabase as any).functions.invoke('send-push-notification', {
        body: {
          orderId,
          status,
          email: currentCustomer.email,
          customerName: currentCustomer.name || 'Cliente',
        },
      });

      if (error) {
        console.warn('[PUSH-SYNC] ⚠️ Erro ao chamar Edge Function:', error);
      } else {
        console.log('[PUSH-SYNC] ✅ Push enviado com sucesso');
      }
    } catch (error) {
      console.error('[PUSH-SYNC] ❌ Erro no envio de push:', error);
      // Não lançar erro - permite que app continue funcionando
    }
  });
}
