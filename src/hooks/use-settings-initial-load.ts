import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Hook que carrega COMPLETO das settings do Supabase na inicialização
 * ✅ NOVO: Usa o novo método loadSettingsFromSupabase() do store
 * Garante que SEMPRE carrega do Supabase, nunca do localStorage
 */
export function useSettingsInitialLoad() {
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    console.log('🚀 [USE-SETTINGS-INITIAL-LOAD] Iniciando carregamento de settings do Supabase...');
    loadSettingsFromSupabase();
  }, [loadSettingsFromSupabase]);
}
