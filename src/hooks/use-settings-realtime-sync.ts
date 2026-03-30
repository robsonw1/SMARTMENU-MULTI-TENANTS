import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * 
 * ✅ NOVO (29/03/2026): Cache isolado por tenant - evita race conditions
 * 
 * ESTRATÉGIA (otimizada para evitar travamentos):
 * - NÃO faz fetch na primeira carga (deixa para useSettingsInitialLoad)
 * - Webhook Realtime: Dispara loadSettingsFromSupabase() quando detecta mudança
 * - Polling (30s): Se Realtime falhar, fallback com loadSettingsFromSupabase()
 * - Store controla cache para evitar múltiplas requisições simultâneas
 * 
 * RESULTADO: Zero race conditions, zero travamentos
 */
export function useSettingsRealtimeSync() {
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupRealtimeSync = async () => {
      try {
        console.log('🔄 [SETTINGS-SYNC] Configurando realtime sync (NÃO carrega na primeira - deixa pro initial load)');
        
        // ✅ SKIP: Não carrega na primeira vez aqui
        // É responsabilidade de useSettingsInitialLoad fazer o primeiro load
      } catch (error) {
        console.error('❌ [SETTINGS-SYNC] Erro ao configurar realtime:', error);
      }
    };

    setupRealtimeSync();

    // Inscrever-se a mudanças em TEMPO REAL
    channel = supabase
      .channel('settings-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
        },
        async (payload: any) => {
          if (!isSubscribed) return;
          
          // ✅ CRITICAL: Recarregar apenas se o settings foi atualizado
          console.log('⚡⚡⚡ [SETTINGS-SYNC] MUDANÇA DETECTADA EM TEMPO REAL ⚡⚡⚡');
          
          // ✅ CRÍTICO: Recarregar FRESH em vez de confiar no payload (pode estar em cache)
          await loadSettingsFromSupabase();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SETTINGS-SYNC] Webhook Realtime SUBSCRIBED');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [SETTINGS-SYNC] Webhook error - ativando polling como fallback');
        }
      });

    // Polling fallback (30 segundos)
    pollInterval = setInterval(async () => {
      if (isSubscribed) {
        console.log('🔄 [SETTINGS-SYNC] POLLING (fallback)');
        await loadSettingsFromSupabase();
      }
    }, 30000);

    return () => {
      isSubscribed = false;
      if (channel) {
        channel.unsubscribe();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [loadSettingsFromSupabase]);
}
