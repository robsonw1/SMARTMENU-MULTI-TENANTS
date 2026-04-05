import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSettingsStore } from '@/store/useSettingsStore';

const PasswordReset = () => {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Por favor, digite seu email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('reset-password', {
        body: {
          email: email.toLowerCase().trim(),
        },
      });

      if (!response.error && response.data?.success) {
        setSuccess(true);
        toast.success('Nova senha enviada para seu email!');
        setTimeout(() => navigate('/admin'), 3000);
      } else {
        setError(response.error?.message || response.data?.error || 'Erro ao recuperar senha');
        toast.error('Erro ao recuperar senha');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Erro ao recuperar senha. Tente novamente.');
      toast.error('Erro ao recuperar senha');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <CardTitle className="font-display text-2xl">Email Enviado</CardTitle>
            <CardDescription>
              Verifique sua caixa de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Uma nova senha foi enviada para <strong>{email}</strong>.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Você será redirecionado para o login em poucos segundos...
            </p>
            <Button
              onClick={() => navigate('/admin')}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src={settings?.store_logo_url || require('@/assets/logo.jpg')}
            alt={settings?.name || 'Reset'}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-4"
          />
          <CardTitle className="font-display text-2xl">Recuperar Senha</CardTitle>
          <CardDescription>
            Digite seu email para recuperar acesso à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isLoading}
            >
              {isLoading ? 'Enviando...' : 'Recuperar Senha'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/admin')}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Login
            </Button>
          </form>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              <strong>ℹ️ Como funciona:</strong> Digite o email da sua conta e receberá uma nova senha por email. Use a nova senha para acessar seu painel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordReset;
