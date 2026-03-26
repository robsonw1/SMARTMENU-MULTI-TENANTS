import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { toast } from 'sonner';
import { Gift, Star, Sparkles, TrendingUp, User, LogIn } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useLoyaltySettingsSync } from '@/hooks/useLoyaltySettingsSync';

interface PostCheckoutLoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  pointsEarned?: number;
}

export function PostCheckoutLoyaltyModal({
  isOpen,
  onClose,
  email,
  pointsEarned = 0,
}: PostCheckoutLoyaltyModalProps) {
  const [step, setStep] = useState<'benefits' | 'account' | 'success'>('benefits');
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('signup');
  
  // Signup form
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
  });

  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    cpf: '',
  });

  const [keepConnected, setKeepConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const registerCustomer = useLoyaltyStore((s) => s.registerCustomer);
  const loginCustomer = useLoyaltyStore((s) => s.loginCustomer);
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const isRemembered = useLoyaltyStore((s) => s.isRemembered);
  const setCurrentCustomer = useLoyaltyStore((s) => s.setCurrentCustomer);

  // 🔄 Sincronizar configurações de fidelização em tempo real
  const loyaltySettings = useLoyaltySettingsSync();
  
  // Cálculos dinâmicos com useMemo para garantir reatividade
  const { signupBonusPoints, pointsPercentage, bonusInReais, discountPer100Points } = useMemo(() => {
    const bonus = loyaltySettings?.signupBonusPoints ?? 50;
    const pointsPerReal = loyaltySettings?.pointsPerReal ?? 1;
    const discount = loyaltySettings?.discountPer100Points ?? 5;
    
    return {
      signupBonusPoints: bonus,
      pointsPercentage: pointsPerReal.toFixed(0),
      bonusInReais: (bonus / 100) * discount,
      discountPer100Points: discount,
    };
  }, [loyaltySettings]);

  const handleClose = () => {
    setStep('benefits');
    setActiveTab('signup');
    setSignupData({ name: '', email: '', cpf: '', phone: '' });
    setLoginData({ email: '', cpf: '' });
    setKeepConnected(true);  // ← Resetar para TRUE (não false) para próxima abertura
    setSuccessMessage('');
    setIsSuccess(false);
    onClose();
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return `(${cleaned}`;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  // Debug: Log mudanças nas settings
  if (isOpen && loyaltySettings) {
    console.log(`🎁 [CHECKOUT] Settings de fidelização: ${signupBonusPoints} pontos bônus, ${pointsPercentage}% cashback`);
  }

  // ✅ DELAY: Após sucesso, aguardar um pouco antes de fechar para garantir que localStorage foi salvo
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        console.log('⏱️  [LOYALTY] Delay de 1s completado, agora fechando modal');
        handleClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  const handleSignup = async () => {
    if (!signupData.name.trim()) {
      toast.error('Informe seu nome');
      return;
    }
    if (!signupData.email.trim() || !signupData.email.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }
    if (!signupData.cpf.trim()) {
      toast.error('Informe o CPF');
      return;
    }
    if (!signupData.phone.trim() || signupData.phone.length < 14) {
      toast.error('Informe um telefone válido (mínimo 11 dígitos)');
      return;
    }

    setIsLoading(true);
    try {
      const success = await registerCustomer(
        signupData.email,
        signupData.cpf.replace(/\D/g, ''),
        signupData.name,
        signupData.phone.replace(/\D/g, '')
      );

      if (success) {
        // ✅ NOVO: Fazer login automático com retry logic
        // Supabase pode levar 200-500ms para replicar, então fazemos retries
        console.log('✅ [LOYALTY] Conta criada com sucesso, tentando fazer login automático...');
        
        let loginSuccess = false;
        const maxRetries = 3;
        const retryDelayMs = 300;
        
        // Tentar fazer login com retry (Supabase pode levar tempo para replicar)
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (attempt > 1) {
            console.log(`🔄 [LOYALTY] Tentativa ${attempt}/${maxRetries} de auto-login...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          }
          
          loginSuccess = await loginCustomer(
            signupData.email,
            signupData.cpf.replace(/\D/g, ''),
            true  // rememberMe = true ← Salva em localStorage
          );
          
          if (loginSuccess) {
            console.log(`✅ [LOYALTY] Auto-login bem-sucedido na tentativa ${attempt}`);
            break;
          }
        }

        if (loginSuccess) {
          console.log('✅ [LOYALTY] Cliente autenticado e será lembrado no próximo acesso');
          setSuccessMessage(`Bem-vindo! ${signupBonusPoints} pontos bônus adicionados 🎉`);
          setStep('success');
          toast.success('✅ Conta criada e você está logado!');
          setIsSuccess(true);
        } else {
          // Login falhou após retries - conta foi criada, usuário pode entrar manualmente depois
          console.warn('⚠️  [LOYALTY] Conta criada mas auto-login falhou após retries');
          setSuccessMessage(`Bem-vindo! ${signupBonusPoints} pontos bônus adicionados 🎉`);
          setStep('success');
          toast.success('✅ Conta criada! Faça login manualmente na próxima vez.');
          setTimeout(() => {
            setIsSuccess(true);
          }, 2000);
        }
      } else {
        toast.error('Email já existe. Tente entrar na aba "Entrar".');
        setActiveTab('login');
      }
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginData.email.trim() || !loginData.email.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }
    if (!loginData.cpf.trim()) {
      toast.error('Informe o CPF');
      return;
    }

    setIsLoading(true);
    try {
      // ✅ SEMPRE salvar login (rememberMe = true por padrão)
      console.log('🔐 [CHECKOUT-LOGIN] Iniciando login com rememberMe=true');
      const success = await loginCustomer(
        loginData.email,
        loginData.cpf.replace(/\D/g, ''),
        true  // ← SEMPRE true agora, para manter conectado por padrão
      );

      console.log('🔐 [CHECKOUT-LOGIN] Resultado do login:', success);
      
      if (success) {
        console.log('🔐 [CHECKOUT-LOGIN] Login bem-sucedido! Ativando delay de 1s...');
        setSuccessMessage('Bem-vindo de volta! Seus pontos foram atualizados ✨');
        setStep('success');
        toast.success('✅ Login realizado com sucesso!');
        setIsSuccess(true);  // ← Também ativa o delay de 1s antes de fechar
      } else {
        console.warn('⚠️  [CHECKOUT-LOGIN] Login falhou!');
        toast.error('Email ou CPF inválido. Tente criar uma conta na aba "Criar Conta".');
        setActiveTab('signup');
      }
    } catch (error) {
      console.error('❌ [CHECKOUT-LOGIN] Erro:', error);
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {/* TELA DE SUCESSO - Cliente logado com rememberMe */}
        {isRemembered && currentCustomer ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                <DialogTitle>Parabéns!</DialogTitle>
              </div>
              <DialogDescription className="text-center pt-2">
                Pontos adicionados com sucesso
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Seus pontos</p>
                <p className="text-5xl font-bold text-primary">{pointsEarned}+</p>
              </div>

              <div className="bg-gradient-to-r from-green-500/10 to-emerald-600/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Seu saldo atual</p>
                    <p className="text-lg font-bold">{currentCustomer.totalPoints} pontos</p>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Gasto</p>
                    <p className="font-semibold text-sm">R$ {currentCustomer.totalSpent.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Compras</p>
                    <p className="font-semibold text-sm">{currentCustomer.totalPurchases}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-muted-foreground">
                <p>💡 Você está com login ativo! Continue acumulando pontos em cada compra e desbloqueie descontos exclusivos.</p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Continuar Comprando
              </Button>
            </DialogFooter>
          </>
        ) : step === 'success' ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                <DialogTitle>Sucesso!</DialogTitle>
              </div>
              <DialogDescription className="text-center pt-2">
                {successMessage}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-8">
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-primary">{signupBonusPoints} Pontos</p>
                <p className="text-sm text-muted-foreground">em sua conta</p>
              </div>

              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  ✨ Aproveite seus pontos em próximas compras ou acumule para descontos maiores!
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Continuar Comprando
              </Button>
            </DialogFooter>
          </>
        ) : step === 'benefits' ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Gift className="w-8 h-8 text-primary" />
                <DialogTitle>GANHE PONTOS AGORA!</DialogTitle>
              </div>
              <DialogDescription className="text-center pt-2">
               Economize a cada compra! Crie ou Acesse sua conta GANHE Cashback. 
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 space-y-3 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{signupBonusPoints} Pontos de Bônus</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {bonusInReais.toFixed(2)} em desconto na sua próxima compra
                    </p>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{pointsPercentage}% de Cashback</p>
                    <p className="text-xs text-muted-foreground">
                      Ganhe em cada compra (100 pontos = R$ {discountPer100Points})
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-muted-foreground">
                  💡 <span className="font-semibold text-foreground">Use o mesmo email e CPF</span> que utilizou no cadastro.
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleSkip} className="flex-1">
                Agora Não
              </Button>
              <Button onClick={() => setStep('account')} className="flex-1">
                Entrar / Cadastrar
              </Button>
            </DialogFooter>
          </>
        ) : step === 'account' ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Gift className="w-8 h-8 text-primary" />
                <DialogTitle>Minha Conta</DialogTitle>
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'signup' | 'login')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup" className="gap-2">
                  <User className="w-4 h-4" />
                  <span>Criar Conta</span>
                </TabsTrigger>
                <TabsTrigger value="login" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Entrar</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB: CRIAR CONTA */}
              <TabsContent value="signup" className="space-y-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo *</Label>
                    <Input
                      id="signup-name"
                      placeholder="Seu nome"
                      value={signupData.name}
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                      disabled={isLoading}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-cpf">CPF *</Label>
                    <Input
                      id="signup-cpf"
                      placeholder="000.000.000-00"
                      value={signupData.cpf}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length > 11) value = value.slice(0, 11);
                        if (value.length <= 3) {
                          setSignupData({ ...signupData, cpf: value });
                        } else if (value.length <= 6) {
                          setSignupData({
                            ...signupData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3)}`,
                          });
                        } else if (value.length <= 9) {
                          setSignupData({
                            ...signupData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`,
                          });
                        } else {
                          setSignupData({
                            ...signupData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`,
                          });
                        }
                      }}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefone com WhatsApp *</Label>
                    <Input
                      id="signup-phone"
                      placeholder="(11) 99999-9999"
                      value={signupData.phone}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setSignupData({ ...signupData, phone: formatted });
                      }}
                      disabled={isLoading}
                      maxLength={15}
                    />
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-muted-foreground">
                      ✅ Ao criar sua conta, você poderá acompanhar seus pedidos e gerenciar seu cadastro. Pontos e descontos especiais são oferecidos após sua primeira compra.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('benefits')} disabled={isLoading} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSignup} disabled={isLoading} className="flex-1">
                    {isLoading ? 'Criando...' : 'Criar Conta'}
                  </Button>
                </div>
              </TabsContent>

              {/* TAB: ENTRAR */}
              <TabsContent value="login" className="space-y-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email *</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-cpf">CPF *</Label>
                    <Input
                      id="login-cpf"
                      placeholder="000.000.000-00"
                      value={loginData.cpf}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length > 11) value = value.slice(0, 11);
                        if (value.length <= 3) {
                          setLoginData({ ...loginData, cpf: value });
                        } else if (value.length <= 6) {
                          setLoginData({
                            ...loginData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3)}`,
                          });
                        } else if (value.length <= 9) {
                          setLoginData({
                            ...loginData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`,
                          });
                        } else {
                          setLoginData({
                            ...loginData,
                            cpf: `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`,
                          });
                        }
                      }}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-secondary">
                    <Checkbox
                      id="keep-connected"
                      checked={keepConnected}
                      onCheckedChange={(checked) => setKeepConnected(checked as boolean)}
                      disabled={isLoading}
                    />
                    <label htmlFor="keep-connected" className="text-sm cursor-pointer flex-1">
                      Me manter conectado
                    </label>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                    <p className="text-xs text-muted-foreground">
                      🔒 <span className="font-semibold text-foreground">Use o mesmo email e CPF</span> que utilizou no cadastro.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('benefits')} disabled={isLoading} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleLogin} disabled={isLoading} className="flex-1">
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}