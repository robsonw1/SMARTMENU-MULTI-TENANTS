import { useState, useEffect } from 'react';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { LogOut, Sparkles, Gift, Clock, MapPin, Package, HelpCircle, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { CustomerHistoryDrawer } from '@/components/CustomerHistoryDrawer';
import { CustomerOrdersDrawer } from '@/components/CustomerOrdersDrawer';
import { DeliveryAddressDialog } from '@/components/DeliveryAddressDialog';
import { CustomerOnboardingTutorial } from '@/components/CustomerOnboardingTutorial';
import { useCustomerOnboarding } from '@/hooks/use-customer-onboarding';
import { useProfileFirstAccess } from '@/hooks/use-profile-first-access';
import { useAddressNotification } from '@/hooks/use-address-notification';
import { useOrdersNotification } from '@/hooks/use-orders-notification';
import { usePWAInstall } from '@/hooks/use-pwa-install';

export function CustomerProfileDropdown() {
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const refreshCurrentCustomer = useLoyaltyStore((s) => s.refreshCurrentCustomer);
  const logout = useLoyaltyStore((s) => s.logoutCustomer);
  const coupons = useLoyaltyStore((s) => s.coupons);
  const { settings, loadSettings } = useLoyaltySettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  // ✅ NOVO: Carregar settings ao montar
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);



  // Hook para gerenciar PWA install
  const { canInstall, isInstalled, isInstalling, triggerInstall } = usePWAInstall();

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

  // Hook para rastrear primeiro acesso ao perfil
  const {
    showPulseNotification,
    markProfileAsViewed,
  } = useProfileFirstAccess();

  // Hook para rastrear notificação de endereço incompleto
  const {
    showAddressNotification,
  } = useAddressNotification();

  // Hook para rastrear notificação de pedidos
  const {
    showOrdersNotification,
    markOrdersAsViewed,
  } = useOrdersNotification();

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
  // ✅ CORRIGIDO: Usar setting dinâmico em vez de hardcoded 5
  const pointsValue = (currentCustomer.totalPoints / 100) * (settings?.discountPer100Points ?? 5);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const handleOrdersOpen = async () => {
    setOrdersOpen(true);
    // Marcar como visualizado quando abrir o drawer
    await markOrdersAsViewed();
  };

  const handleAddressOpen = () => {
    setAddressOpen(true);
  };

  const handleDownloadApp = async () => {
    // Disparar o prompt de instalação nativo do navegador
    await triggerInstall();
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
      <Popover open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        // Quando abrir o popover, só marcar primeira visita como visualizada
        if (open && showPulseNotification) {
          markProfileAsViewed();
        }
      }}>
        <PopoverTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors relative cursor-pointer ${
              (showPulseNotification || showOrdersNotification) ? 'animate-pulse' : ''
            }`}
            title={currentCustomer.name}
          >
            {getInitials(currentCustomer.name || 'C')}
            
            {/* Badge - primeira vez ou novo pedido/status alterado */}
            {(showPulseNotification || showOrdersNotification) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-primary-foreground shadow-lg"
              />
            )}
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

              {/* Economizado com Pontos */}
              <div className="flex items-center justify-between bg-gradient-to-r from-green-500/10 to-green-400/5 rounded-lg p-3 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Cashback</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-green-600">
                    R$ {pointsValue.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    com seus {currentCustomer.totalPoints} pontos
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 border-t space-y-2">
              <Button
                id="btn-meus-pedidos"
                onClick={handleOrdersOpen}
                variant="outline"
                size="sm"
                className={`w-full flex items-center justify-center gap-2 relative ${
                  showOrdersNotification ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className="relative">
                  <Package className="w-4 h-4" />
                  {showOrdersNotification && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"
                    />
                  )}
                </div>
                Meus Pedidos
                {showOrdersNotification && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse ml-auto"
                  />
                )}
              </Button>
              <Button
                id="btn-meu-endereco"
                onClick={handleAddressOpen}
                variant="outline"
                size="sm"
                className={`w-full flex items-center justify-center gap-2 relative ${
                  showAddressNotification ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''
                }`}
              >
                <div className="relative">
                  <MapPin className="w-4 h-4" />
                  {showAddressNotification && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"
                    />
                  )}
                </div>
                Meu Endereço
                {showAddressNotification && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ml-auto"
                  />
                )}
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

              {/* Botão Baixar App - Apenas quando PWA pode ser instalado */}
              {canInstall && !isInstalled && (
                <Button
                  id="btn-baixar-app"
                  onClick={handleDownloadApp}
                  disabled={isInstalling}
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 bg-primary/5 border-primary/30 hover:bg-primary/10 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isInstalling ? 'Instalando...' : 'Baixar App'}
                </Button>
              )}

              {/* Mensagem quando já instalado */}
              {isInstalled && (
                <div className="w-full text-center p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                    ✅ App instalado com sucesso!
                  </p>
                </div>
              )}

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
