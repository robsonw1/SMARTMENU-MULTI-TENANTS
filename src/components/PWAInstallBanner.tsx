import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { useUIStore } from '@/store/useStore';

export function PWAInstallBanner() {
  const { canInstall, isInstalling, triggerInstall, isInstalled } = usePWAInstall();
  const isCartOpen = useUIStore((s) => s.isCartOpen);
  const isProductModalOpen = useUIStore((s) => s.isProductModalOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // ✅ NOVO (07/04/2026): Desaparecer banner quando carrinho ou produto modal abre
    // Mostrar banner SE pode instalar E não foi dismissado E não está instalado
    // E carrinho está fechado E popup de produto está fechado
    if (canInstall && !isDismissed && !isInstalled && !isCartOpen && !isProductModalOpen) {
      // Delay pequenininho para animação mais suave
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [canInstall, isDismissed, isInstalled, isCartOpen, isProductModalOpen]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Permitir mostrar novamente após 1 dia
    setTimeout(() => setIsDismissed(false), 24 * 60 * 60 * 1000);
  };

  const handleInstall = async () => {
    await triggerInstall();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 z-[9999] max-w-sm mx-auto lg:left-auto lg:right-4 lg:max-w-md"
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl shadow-2xl overflow-hidden border border-primary/50">
            <div className="flex items-center justify-between p-4 gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex-shrink-0"
                >
                  <Download className="w-6 h-6 text-primary-foreground" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-primary-foreground text-sm leading-tight">
                    📱 Instale nosso App
                  </p>
                  <p className="text-xs text-primary-foreground/85 leading-tight">
                    Acesso rápido no seu menu
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="px-4 py-2 bg-white text-primary rounded-lg font-bold text-xs sm:text-sm hover:bg-white/95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-md"
                >
                  {isInstalling ? '⏳ Instalando...' : '✨ Instalar'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDismiss}
                  className="flex-shrink-0 text-primary-foreground hover:bg-primary/30 p-2 rounded-lg transition-colors"
                  title="Dispensar"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

