import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, UserPlus, Phone, Smartphone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSignupSuccess?: () => void;
  onOpenAddressDialog?: () => void;
}

export function CustomerLoginModal({
  isOpen,
  onClose,
  onSuccess,
  onSignupSuccess,
  onOpenAddressDialog,
}: CustomerLoginModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCpf, setLoginCpf] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // Signup fields
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCpf, setSignupCpf] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);

  const loginCustomer = useLoyaltyStore((s) => s.loginCustomer);
  const registerCustomerWithoutBonus = useLoyaltyStore((s) => s.registerCustomerWithoutBonus);

  const formatCpf = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 3) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length > 6) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    if (cleaned.length > 9) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    return formatted;
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return `(${cleaned}`;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    
    // 10 dígitos: (XX) XXXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    // 11 dígitos: (XX) XXXXX-XXXX
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handleCpfInput = (value: string, isSignup: boolean = false) => {
    if (isSignup) {
      setSignupCpf(formatCpf(value));
    } else {
      setLoginCpf(formatCpf(value));
    }
  };

  const handlePhoneInput = (value: string) => {
    setSignupPhone(formatPhoneNumber(value));
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }

    if (!loginCpf.trim() || loginCpf.replace(/\D/g, '').length !== 11) {
      toast.error('Informe um CPF válido');
      return;
    }

    setIsLoading(true);
    try {
      const success = await loginCustomer(loginEmail, loginCpf.replace(/\D/g, ''), rememberMe);

      if (success) {
        toast.success('✅ Bem-vindo! Dados carregados com sucesso');
        setLoginEmail('');
        setLoginCpf('');
        setRememberMe(false);
        onClose();
        onSuccess?.();
      } else {
        toast.error('❌ Email ou CPF inválidos. Dados não encontrados.');
      }
    } catch (error) {
      console.error('Erro de login:', error);
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    // Validações
    if (!signupName.trim()) {
      toast.error('Informe seu nome');
      return;
    }

    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }

    if (!signupCpf.trim() || signupCpf.replace(/\D/g, '').length !== 11) {
      toast.error('Informe um CPF válido');
      return;
    }

    if (!signupPhone.trim() || signupPhone.length < 14) {
      toast.error('Informe um telefone válido (mínimo 11 dígitos)');
      return;
    }

    setIsLoading(true);
    try {
      const success = await registerCustomerWithoutBonus(
        signupEmail,
        signupCpf.replace(/\D/g, ''),
        signupName,
        signupPhone.replace(/\D/g, '')
      );

      if (success) {
        setSignupEmail('');
        setSignupName('');
        setSignupCpf('');
        setSignupPhone('');
        onClose();
        onSignupSuccess?.();
        
        // ✨ Toast com ação: Sim (abrir dialog de endereço) ou Depois (apenas fechar)
        toast.success('✅ Conta criada com sucesso!', {
          description: 'Deseja preencher seu endereço de entrega padrão agora?',
          action: {
            label: 'Preencher Agora',
            onClick: () => {
              onOpenAddressDialog?.();
            },
          },
          duration: 8000, // 8 segundos para o usuário decidir
        });
      } else {
        toast.error('Erro ao criar conta. Verifique seus dados e tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
      toast.error('Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginEmail('');
    setLoginCpf('');
    setSignupEmail('');
    setSignupName('');
    setSignupCpf('');
    setSignupPhone('');
    setActiveTab('login');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center gap-2 mb-2">
            <LogIn className="w-8 h-8 text-primary" />
            <DialogTitle>Minha Conta</DialogTitle>
          </div>
          <DialogDescription className="text-center pt-2">
            Acesse sua conta ou crie uma nova
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mt-4">
            <TabsTrigger value="login" className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              <span>Entrar</span>
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Criar Conta</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB: LOGIN */}
          <TabsContent value="login" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email *</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-cpf">CPF *</Label>
              <Input
                id="login-cpf"
                placeholder="000.000.000-00"
                value={loginCpf}
                onChange={(e) => handleCpfInput(e.target.value, false)}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-3">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={isLoading}
              />
              <Label htmlFor="remember-me" className="flex-1 text-sm font-medium cursor-pointer mb-0">
                <span className="flex items-center gap-1">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Me manter conectado
                </span>
              </Label>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-muted-foreground">
              <p>💡 Use o mesmo email e CPF que utilizou no cadastro.</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </div>
          </TabsContent>

          {/* TAB: SIGNUP */}
          <TabsContent value="signup" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Nome Completo *</Label>
              <Input
                id="signup-name"
                placeholder="Seu nome"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email *</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="seu@email.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-cpf">CPF *</Label>
              <Input
                id="signup-cpf"
                placeholder="000.000.000-00"
                value={signupCpf}
                onChange={(e) => handleCpfInput(e.target.value, true)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-phone">Telefone com WhatsApp *</Label>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="signup-phone"
                  placeholder="(11) 99999-9999"
                  value={signupPhone}
                  onChange={(e) => handlePhoneInput(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Separator className="my-3" />

            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-xs">
              <p className="text-muted-foreground">
                ℹ️ Ao criar sua conta, você poderá acompanhar seus pedidos e gerenciar seu cadastro. Pontos e descontos especiais são oferecidos após sua primeira compra.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSignup}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Criando...' : 'Criar Conta'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
