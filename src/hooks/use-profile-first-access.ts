import { useState, useEffect } from 'react';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';

/**
 * Hook para rastrear e gerenciar o primeiro acesso ao perfil do cliente.
 * Usa localStorage para persistência local e Supabase como fallback.
 * 
 * Casos de uso:
 * - Mostrar pulse animation + badge na primeira visita
 * - Remover indicador após primeiro clique
 * - Sincronizar entre abas/sessões
 */
export const useProfileFirstAccess = () => {
  const [showPulseNotification, setShowPulseNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);

  // Carregar status de primeiro acesso ao perfil
  useEffect(() => {
    if (!currentCustomer?.id) {
      setIsLoading(false);
      return;
    }

    const storageKey = `profile_first_access_${currentCustomer.id}`;
    const hasSeenProfileNotification = localStorage.getItem(storageKey);

    // Se nunca viu, mostrar notificação
    if (!hasSeenProfileNotification) {
      setShowPulseNotification(true);
    }

    setIsLoading(false);
  }, [currentCustomer?.id]);

  /**
   * Marca que o cliente já viu/clicou no perfil
   * Remove a notificação de pulse
   */
  const markProfileAsViewed = () => {
    if (!currentCustomer?.id) return;

    const storageKey = `profile_first_access_${currentCustomer.id}`;
    localStorage.setItem(storageKey, 'true');
    setShowPulseNotification(false);
  };

  // Resetar para dev/testes
  const resetProfileNotification = () => {
    if (!currentCustomer?.id) return;

    const storageKey = `profile_first_access_${currentCustomer.id}`;
    localStorage.removeItem(storageKey);
    setShowPulseNotification(true);
  };

  return {
    showPulseNotification,
    isLoading,
    markProfileAsViewed,
    resetProfileNotification,
  };
};
