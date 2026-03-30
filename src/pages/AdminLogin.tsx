import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import logoForneiro from '@/assets/logo-forneiro.jpg';

const AdminLogin = () => {
  const navigate = useNavigate();
  // 🔒 CRÍTICO: Desabilitar auto-restore aqui
  // AdminLogin não precisa restaurar, apenas fazer login
  // Restauração acontece em AdminDashboard
  const { login, isLoading, error: authError } = useAdminAuth({ enableAutoRestore: false });
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha email e senha');
      return;
    }

    const success = await login(email, password);
    if (success) {
      // Pequeno delay para garantir que tenantId foi atualizado
      setTimeout(() => navigate('/admin/dashboard'), 500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src={logoForneiro} 
            alt="Forneiro Éden" 
            className="w-16 h-16 rounded-full object-cover mx-auto mb-4"
          />
          <CardTitle className="font-display text-2xl">Forneiro Éden</CardTitle>
          <CardDescription>Painel Administrativo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {(error || authError) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error || authError}</p>
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => navigate('/admin/recuperar-senha')}
              disabled={isLoading}
            >
              Esqueci minha senha
            </Button>
          </form>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              <strong>Demo:</strong> Recebeu o email com suas credenciais? Use o email e senha temporária fornecidos para fazer seu primeiro login.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;

