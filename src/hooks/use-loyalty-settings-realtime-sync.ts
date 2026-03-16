import { useEffect } from 'react';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações de fidelização em tempo real do Supabase
 * SINCRONIZA: pointsPerReal, minPointsToRedeem, signupBonusPoints, etc
 * 
 * ESTRATÉGIA: Sempre usa loadSettings() para garantir FRESH reads com SELECT fresh
 * - Webhook Realtime: Dispara loadSettings() quando detecta mudança
 * - Polling (30s): Se Realtime falhar, também usa loadSettings()
 * - Initial Load: Usa loadSettings() na primeira carga
 * 
 * LOGS IMPORTANTES:
 * - ⚡⚡⚡ [LOYALTY-SETTINGS-SYNC] MUDANÇA DETECTADA: Webhook Realtime funcionando
 * - 🔄 [LOYALTY-SETTINGS-SYNC] POLLING: Fallback ativado
 */
export function useLoyaltySettingsRealtimeSync() {
  const loadSettings = useLoyaltySettingsStore((s) => s.loadSettings);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupRealtimeSync = async () => {
      try {
        console.log('🔄 [LOYALTY-SETTINGS-SYNC] Carregando configurações FRESH do Supabase...');
        
        // ✅ ALWAYS uses loadSettings que faz SELECT fresh com verificação
        if (isSubscribed) {
          await loadSettings();
          console.log('✅ [LOYALTY-SETTINGS-SYNC] Store atualizado FRESH na primeira carga');
        }
      } catch (error) {
        console.error('❌ [LOYALTY-SETTINGS-SYNC] Erro ao configurar realtime:', error);
      }
    };

    setupRealtimeSync();

    // Inscrever-se a mudanças em TEMPO REAL
    channel = supabase
      .channel('loyalty-settings-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loyalty_settings',
        },
        async (payload: any) => {
          if (!isSubscribed) return;

          console.log('⚡⚡⚡ [LOYALTY-SETTINGS-SYNC] MUDANÇA DETECTADA EM TEMPO REAL ⚡⚡⚡');
          
          // ✅ CRÍTICO: Recarregar FRESH em vez de confiar no payload (pode estar em cache)
          await loadSettings();
          console.log('✅✅✅ [LOYALTY-SETTINGS-SYNC] Store SINCRONIZADO com dados FRESH ✅✅✅');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [LOYALTY-SETTINGS-SYNC] Canal Realtime ATIVO - ouvindo mudanças');
        } else if (status === 'CLOSED') {
          console.log('🔴 [LOYALTY-SETTINGS-SYNC] Canal Realtime FECHADO');
        } else if (error) {
          console.error('❌ [LOYALTY-SETTINGS-SYNC] Erro Realtime:', error);
        }
      });

    // ⏰ FALLBACK POLLING: Verificar mudanças a cada 30 segundos se Realtime falhar
    pollInterval = setInterval(async () => {
      if (!isSubscribed) return;

      try {
        // ✅ Polling: Busca sempre FRESH
        console.log('🔄 [LOYALTY-SETTINGS-SYNC] POLLING: Verificando atualizações...');
        await loadSettings();
      } catch (err) {
        console.error('❌ [LOYALTY-SETTINGS-SYNC] Erro no polling:', err);
      }
    }, 30000); // 30 segundos

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [loadSettings]);
}
