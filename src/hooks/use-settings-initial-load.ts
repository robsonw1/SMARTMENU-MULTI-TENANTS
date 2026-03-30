import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Hook que carrega COMPLETO das settings do Supabase na inicialização
 * ✅ NOVO (29/03/2026): Cache isolado por tenant - evita múltiplas requisições
 * 
 * Estratégia:
 * - Primeira carga: fetch do Supabase
 * - Mesma sessão = mesmo tenant: retorna do cache (5min TTL)
 * - Muda para outro tenant: novo fetch
 */
export function useSettingsInitialLoad() {
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) {
      console.log('🚀 [USE-SETTINGS-INITIAL-LOAD] Já foi carregado - usando cache do store');
      return;
    }
    hasLoaded.current = true;

    console.log('🚀 [USE-SETTINGS-INITIAL-LOAD] Iniciando carregamento de settings do Supabase...');
    loadSettingsFromSupabase();
  }, [loadSettingsFromSupabase]);
}
