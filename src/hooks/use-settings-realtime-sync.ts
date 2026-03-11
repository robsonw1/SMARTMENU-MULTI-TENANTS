import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que sincroniza as configurações em tempo real do Supabase
 * SINCRONIZA: isManuallyOpen (CRÍTICO), schedule, timing, etc
 * 
 * ESTRATÉGIA: Sempre usa loadSettingsFromSupabase() para garantir FRESH reads com SELECT fresh
 * - Webhook Realtime: Dispara loadSettingsFromSupabase() quando detecta mudança
 * - Polling (30s): Se Realtime falhar, também usa loadSettingsFromSupabase()
 * - Initial Load: Usa loadSettingsFromSupabase() na primeira carga
 * 
 * LOGS IMPORTANTES:
 * - ⚡⚡⚡ [SETTINGS-SYNC] MUDANÇA DETECTADA: Webhook Realtime funcionando
 * - 🔄 [SETTINGS-SYNC] POLLING: Fallback ativado
 */
export function useSettingsRealtimeSync() {
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupRealtimeSync = async () => {
      try {
        console.log('🔄 [SETTINGS-SYNC] Carregando configurações FRESH do Supabase...');
        
        // ✅ ALWAYS uses loadSettingsFromSupabase que faz SELECT fresh com verificação
        if (isSubscribed) {
          await loadSettingsFromSupabase();
          console.log('✅ [SETTINGS-SYNC] Store atualizado FRESH na primeira carga');
        }
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
          
          // ✅ CRITICAL: Filtrar apenas store-settings
          if (payload.new.id !== 'store-settings') return;

          console.log('⚡⚡⚡ [SETTINGS-SYNC] MUDANÇA DETECTADA EM TEMPO REAL ⚡⚡⚡');
          
          // ✅ CRÍTICO: Recarregar FRESH em vez de confiar no payload (pode estar em cache)
          await loadSettingsFromSupabase();
          console.log('✅✅✅ [SETTINGS-SYNC] Store SINCRONIZADO com dados FRESH ✅✅✅');
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SETTINGS-SYNC] Canal Realtime ATIVO - ouvindo mudanças');
        } else if (status === 'CLOSED') {
          console.log('🔴 [SETTINGS-SYNC] Canal Realtime FECHADO');
        } else if (error) {
          console.error('❌ [SETTINGS-SYNC] Erro Realtime:', error);
        }
      });

    // ⏰ FALLBACK POLLING: Verificar mudanças a cada 30 segundos se Realtime falhar
    pollInterval = setInterval(async () => {
      if (!isSubscribed) return;

      try {
        // ✅ Polling: Busca sempre FRESH
        console.log('🔄 [SETTINGS-SYNC] POLLING: Verificando atualizações...');
        await loadSettingsFromSupabase();
      } catch (err) {
        console.error('❌ [SETTINGS-SYNC] Erro no polling:', err);
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
  }, [loadSettingsFromSupabase]);
}
