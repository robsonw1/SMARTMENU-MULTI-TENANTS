import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // ID do elemento para highlight
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '👋 Bem-vindo(a)!',
    description: 'Vamos conhecer este espaço. Este é seu painel de cliente onde você gerencia tudo!',
  },
  {
    id: 'orders',
    title: '📦 Meus Pedidos',
    description: 'Clique aqui para ver o histórico de todos os seus pedidos. Você pode acompanhar o status de cada um.',
    target: 'btn-meus-pedidos',
  },
  {
    id: 'address',
    title: '📍 Meu Endereço',
    description: 'Gerencie seu endereço de entrega padrão. Ele será usado automaticamente em seus pedidos.',
    target: 'btn-meu-endereco',
  },
  {
    id: 'history',
    title: '📜 Histórico',
    description: 'Veja toda a sua jornada na pizzaria. Um resumo completo de todas as suas compras!',
    target: 'btn-historico',
  },
  {
    id: 'logout',
    title: '🚪 Sair da Conta',
    description: 'Clique aqui quando quiser fazer logout seguro. Sua conta estará protegida.',
    target: 'btn-sair-conta',
  },
  {
    id: 'end',
    title: '🎉 Pronto!',
    description: 'Agora você já conhece o painel! Boa sorte com seus pedidos e aproveite as promoções! 🍕',
  },
];

export const useCustomerOnboarding = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);

  // Carregar status do onboarding quando cliente faz login
  useEffect(() => {
    const loadOnboardingStatus = async () => {
      if (!currentCustomer?.id) return;

      try {
        const { data, error } = await (supabase as any)
          .from('customers')
          .select('has_seen_onboarding')
          .eq('id', currentCustomer.id)
          .single();

        if (error) {
          console.error('Erro ao carregar onboarding status:', error);
          return;
        }

        const seen = data?.has_seen_onboarding || false;
        setHasSeenOnboarding(seen);

        // Se é primeira vez (não viu), mostra tutorial automaticamente
        if (!seen) {
          setIsOpen(true);
          setCurrentStep(0);
        }
      } catch (error) {
        console.error('Erro em loadOnboardingStatus:', error);
      }
    };

    loadOnboardingStatus();
  }, [currentCustomer?.id]);

  // Marcar como visto no Supabase quando completar tutorial
  const markAsSeenInDatabase = async () => {
    if (!currentCustomer?.id) return;

    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('customers')
        .update({ has_seen_onboarding: true })
        .eq('id', currentCustomer.id);

      if (error) {
        console.error('Erro ao marcar onboarding como visto:', error);
        return;
      }

      setHasSeenOnboarding(true);
      console.log('✅ Onboarding marcado como visto no banco de dados');
    } catch (error) {
      console.error('Erro em markAsSeenInDatabase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Avançar para próxima etapa
  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Última etapa - fechar e marcar como visto
      completeOnboarding();
    }
  };

  // Voltar para etapa anterior
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Pular tutorial
  const skipOnboarding = async () => {
    await markAsSeenInDatabase();
    setIsOpen(false);
    setCurrentStep(0);
  };

  // Completar tutorial
  const completeOnboarding = async () => {
    await markAsSeenInDatabase();
    setIsOpen(false);
    setCurrentStep(0);
  };

  // Abrir tutorial manualmente (para botão de ajuda)
  const openTutorial = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Resetar onboarding (admin/dev)
  const resetOnboarding = async () => {
    if (!currentCustomer?.id) return;

    try {
      const { error } = await (supabase as any)
        .from('customers')
        .update({ has_seen_onboarding: false })
        .eq('id', currentCustomer.id);

      if (error) {
        console.error('Erro ao resetar onboarding:', error);
        return;
      }

      setHasSeenOnboarding(false);
      setCurrentStep(0);
      setIsOpen(true);
      console.log('🔄 Onboarding resetado');
    } catch (error) {
      console.error('Erro em resetOnboarding:', error);
    }
  };

  return {
    isOpen,
    setIsOpen,
    currentStep,
    setCurrentStep,
    hasSeenOnboarding,
    steps: ONBOARDING_STEPS,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    openTutorial,
    resetOnboarding,
    isLoading,
  };
};
