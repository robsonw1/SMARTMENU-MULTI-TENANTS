import { useEffect } from 'react';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para sincronizar configurações de fidelização em tempo real
 * Carrega as settings ao montar e setupar realtime listener
 */
export const useLoyaltySettingsSync = () => {
  const loadSettings = useLoyaltySettingsStore((s) => s.loadSettings);
  const settings = useLoyaltySettingsStore((s) => s.settings);

  useEffect(() => {
    // Carregar settings na primeira vez
    loadSettings();

    // Setupar realtime subscription para mudanças
    const channel = supabase
      .channel('loyalty_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Ouve UPDATE, INSERT, DELETE
          schema: 'public',
          table: 'loyalty_settings',
        },
        () => {
          console.log('🔄 [LOYALTY] Configurações de fidelização atualizadas no servidor, recarregando...');
          // Recarregar settings sempre que mudam
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadSettings]);

  return settings;
};
