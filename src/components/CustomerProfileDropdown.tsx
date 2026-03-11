import { useState } from 'react';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { LogOut, Sparkles, TrendingUp, Gift, Clock, MapPin, Package, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { CustomerHistoryDrawer } from '@/components/CustomerHistoryDrawer';
import { CustomerOrdersDrawer } from '@/components/CustomerOrdersDrawer';
import { DeliveryAddressDialog } from '@/components/DeliveryAddressDialog';
import { CustomerOnboardingTutorial } from '@/components/CustomerOnboardingTutorial';
import { useCustomerOnboarding } from '@/hooks/use-customer-onboarding';

export function CustomerProfileDropdown() {
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const logout = useLoyaltyStore((s) => s.logoutCustomer);
  const coupons = useLoyaltyStore((s) => s.coupons);
  const [isOpen, setIsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  // Hook para gerenciar onboarding
  const {
    isOpen: isOnboardingOpen,
    currentStep,
    steps,
    nextStep,
    prevStep,
    skipOnboarding,
    openTutorial,
    isLoading: isOnboardingLoading,
  } = useCustomerOnboarding();

  if (!currentCustomer) {
    return null;
  }

  // Determinar tier baseado em pontos
  const getTierInfo = (points: number) => {
    if (points >= 500) {
      return { 
        current: { name: 'Ouro', icon: '👑', color: 'text-yellow-500' },
        nextThreshold: null,
        progress: 100
      };
    }
    if (points >= 250) {
      return { 
        current: { name: 'Prata', icon: '🥈', color: 'text-slate-400' },
        nextThreshold: 500,
        progress: ((points - 250) / (500 - 250)) * 100
      };
    }
    return { 
      current: { name: 'Bronze', icon: '🥉', color: 'text-amber-700' },
      nextThreshold: 250,
      progress: (points / 250) * 100
    };
  };

  const tierInfo = getTierInfo(currentCustomer.totalPoints);
  const pointsValue = (currentCustomer.totalPoints / 100) * 5;

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors relative cursor-pointer"
            title={currentCustomer.name}
          >
            {getInitials(currentCustomer.name || 'C')}
          </motion.button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0 border-0 shadow-2xl" align="end">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 p-4"
          >
            {/* Header com nome e email */}
            <div className="space-y-2 pb-4 border-b">
              <div>
                <h3 className="font-bold text-lg">{currentCustomer.name || 'Cliente'}</h3>
                <p className="text-xs text-muted-foreground">{currentCustomer.email}</p>
              </div>
            </div>

            {/* Tier com Progresso */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{tierInfo.current.icon}</span>
                  <span className="font-bold text-lg">{tierInfo.current.name}</span>
                </div>
                <span className="text-sm font-mono">{currentCustomer.totalPoints}pts</span>
              </div>

              {tierInfo.nextThreshold && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Faltam {tierInfo.nextThreshold - currentCustomer.totalPoints} pontos
                    </span>
                    <span className="font-medium">
                      {Math.round(tierInfo.progress)}%
                    </span>
                  </div>
                  <Progress value={tierInfo.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Próximo: {tierInfo.current.name === 'Bronze' ? '🥈 Prata' : '👑 Ouro'}
                  </p>
                </div>
              )}
              {!tierInfo.nextThreshold && (
                <div className="text-xs text-muted-foreground italic">
                  ✨ Você atingiu o máximo!
                </div>
              )}
            </div>

            {/* Stats em miniatura */}
            <div className="space-y-3">
              {/* Saldo de Pontos */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Saldo</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{currentCustomer.totalPoints}</p>
                  <p className="text-xs text-muted-foreground">
                    ≈ R$ {pointsValue.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Total Gasto */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Gasto</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">
                    R$ {currentCustomer.totalSpent.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentCustomer.totalPurchases} compras
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 border-t space-y-2">
              <Button
                id="btn-meus-pedidos"
                onClick={() => setOrdersOpen(true)}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                Meus Pedidos
              </Button>
              <Button
                id="btn-meu-endereco"
                onClick={() => setAddressOpen(true)}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Meu Endereço
              </Button>
              <Button
                id="btn-historico"
                onClick={() => setHistoryOpen(true)}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Histórico
              </Button>
              <Button
                id="btn-sair-conta"
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </Button>

              {/* Botão de Ajuda (Tutorial) */}
              <div className="pt-2 border-t">
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    openTutorial();
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                >
                  <HelpCircle className="w-4 h-4" />
                  Como Usar
                </Button>
              </div>
            </div>
          </motion.div>
        </PopoverContent>
      </Popover>

      {/* History Drawer */}
      <CustomerHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Orders Drawer */}
      <CustomerOrdersDrawer
        isOpen={ordersOpen}
        onClose={() => setOrdersOpen(false)}
      />

      {/* Address Dialog */}
      <DeliveryAddressDialog
        isOpen={addressOpen}
        onClose={() => setAddressOpen(false)}
      />

      {/* Onboarding Tutorial */}
      <CustomerOnboardingTutorial
        isOpen={isOnboardingOpen}
        currentStep={currentStep}
        steps={steps}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipOnboarding}
        isLoading={isOnboardingLoading}
      />
    </>
  );
}
