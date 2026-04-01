import { Phone, MapPin, Clock, LogIn, Lock, Share2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsStore, WeekSchedule } from '@/store/useSettingsStore';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { CustomerProfileDropdown } from '@/components/CustomerProfileDropdown';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import logoForneiro from '@/assets/logo-forneiro.jpg';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface FooterProps {
  onLoginClick?: () => void;
  onAdminClick?: () => void;
}

const dayLabels: Record<keyof WeekSchedule, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export function Footer({ onLoginClick, onAdminClick }: FooterProps) {
  const settings = useSettingsStore((s) => s.settings);
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const isLoading = useSettingsStore((s) => s._isLoadingInProgress);
  const cachedCategories = localStorage.getItem('cached_categories_config');

  // 📍 Se carregando E não tem cache, mostrar "Carregando..."
  if (isLoading && !cachedCategories) {
    return (
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg text-foreground">Carregando...</p>
        </div>
      </footer>
    );
  }

  const handleShareQR = async () => {
    const shareText = `Peça sua pizza no ${settings.name}! 🍕 ${appUrl}`;

    // Tentar usar Web Share API (mobile, mais bonito)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.name} - Pedir Pizza Online`,
          text: shareText,
          url: appUrl,
        });
        toast.success('Compartilhado com sucesso!');
      } catch (error) {
        console.log('Compartilhamento cancelado pelo usuário');
      }
    } else {
      // Fallback: copiar para clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Link copiado! Cole em qualquer lugar');
      } catch (error) {
        toast.error('Erro ao copiar link');
      }
    }
  };

  const buildScheduleString = () => {
    const schedule = settings.schedule;
    const openDays: string[] = [];
    const dayOrder: (keyof WeekSchedule)[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    dayOrder.forEach((day) => {
      if (schedule[day].isOpen) {
        openDays.push(
          `${dayLabels[day]}: ${schedule[day].openTime} às ${schedule[day].closeTime}`
        );
      }
    });

    if (openDays.length === 0) return 'Fechado';
    if (openDays.length <= 2) return openDays.join(' | ');
    return `${openDays.slice(0, 2).join(' | ')} ...`;
  };

  return (
    <footer className="bg-card border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logoForneiro}
                alt={settings.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <span className="font-display text-lg font-bold">
                  {settings.name.split(' ')[0] || 'Forneiro'}
                </span>
                <span className="font-display text-sm text-primary block -mt-1">
                  {settings.name.split(' ').slice(1).join(' ') || 'Éden'}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{settings.slogan}</p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{settings.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{settings.address}</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{buildScheduleString()}</p>
                  <ScheduleDialog />
                </div>
              </div>
            </div>
          </div>

          {/* QR Code & App Download */}
          <div>
            <h4 className="font-semibold mb-4">📱 Baixe Nosso App</h4>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-secondary p-3 rounded-lg">
                <QRCodeDisplay size={100} showControls={false} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan para acessar de qualquer lugar
              </p>
              <Button
                onClick={handleShareQR}
                variant="outline"
                size="sm"
                className="gap-2 w-full"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </Button>
            </div>
          </div>
        </div>

        {/* Actions Row */}
        <div className="border-t pt-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {currentCustomer ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Minha Conta:</span>
                  <CustomerProfileDropdown />
                </div>
              </>
            ) : (
              <Button
                onClick={onLoginClick}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <LogIn className="w-4 h-4" />
                Entrar na Minha Conta
              </Button>
            )}
            <Button
              variant="outline"
              className="flex items-center gap-2 w-full sm:w-auto"
              asChild
            >
              <Link to="/admin" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Área Admin
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-2 w-full sm:w-auto font-semibold"
              asChild
            >
              <Link to="/cadastro" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Cadastrar Sua Loja
              </Link>
            </Button>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© 2024 {settings.name}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
