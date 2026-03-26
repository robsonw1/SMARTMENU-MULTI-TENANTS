import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building2, Mail, Phone, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CadastroPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ url: string; email: string } | null>(null);

  const [form, setForm] = useState({
    establishment_name: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.establishment_name.trim()) {
      newErrors.establishment_name = 'Nome do estabelecimento é obrigatório';
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      newErrors.email = 'Email válido é obrigatório';
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Telefone válido é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📤 Enviando formulário de cadastro:', form);

      // Chamar edge function create-tenant
      const response = await supabase.functions.invoke('create-tenant', {
        body: {
          establishment_name: form.establishment_name,
          email: form.email,
          phone: form.phone.replace(/\D/g, ''),
        },
      });

      console.log('📥 Response:', response);

      if (response.error) {
        console.error('❌ Erro na edge function:', response.error);
        toast.error(`Erro ao criar estabelecimento: ${response.error.message}`);
        return;
      }

      const data = response.data as any;

      if (!data.success) {
        toast.error(data.error || 'Erro desconhecido ao criar estabelecimento');
        return;
      }

      console.log('✅ Tenant criado com sucesso!', data);

      // Mostrar sucesso
      setSuccessData({
        url: data.login_url || `https://${form.establishment_name.toLowerCase().replace(/\s/g, '-')}-app.aezap.site`,
        email: form.email,
      });
      setIsSuccess(true);
      toast.success('Estabelecimento criado com sucesso! Verifique seu email.');

    } catch (err) {
      console.error('❌ Erro geral:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return `(${cleaned}`;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;

    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }

    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  if (isSuccess && successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-2 border-green-200 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-green-700">Estabelecimento Criado!</CardTitle>
            <CardDescription className="text-base mt-2">Sua loja online está pronta para usar</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700 mb-3">
                📧 Um email foi enviado para <strong>{successData.email}</strong> com suas credenciais de acesso.
              </p>

              <p className="text-sm text-green-700">
                Verifique sua caixa de entrada (e pasta de spam) para:
              </p>
              <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                <li>Email para login</li>
                <li>Senha temporária gerada automaticamente</li>
                <li>Link direto para seu painel</li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs text-gray-600">Seu Link de Acesso:</Label>
              <div className="bg-gray-100 p-3 rounded border border-gray-300 break-all font-mono text-sm">
                {successData.url}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>⚡ Próximos passos:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-blue-800 mt-2 space-y-1">
                <li>Acesse o link acima com suas credenciais</li>
                <li>Altere sua senha em Configurações</li>
                <li>Customize sua loja (nome, cores, logo)</li>
                <li>Ative/desative opções do cardápio</li>
                <li>Configure WhatsApp para notificações</li>
                <li>Ative sua loja e comece a receber pedidos!</li>
              </ol>
            </div>

            <Button onClick={() => navigate('/')} className="w-full btn-cta">
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-6 h-6 text-orange-600" />
            <div>
              <CardTitle className="text-2xl">Cadastre sua Loja</CardTitle>
              <CardDescription>Crie sua plataforma de pedidos online em minutos</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome do Estabelecimento */}
            <div>
              <Label htmlFor="establishment_name" className="text-sm font-medium">
                Nome do Estabelecimento *
              </Label>
              <Input
                id="establishment_name"
                placeholder="Ex: Pizzaria Forneiro Éden"
                value={form.establishment_name}
                onChange={(e) => {
                  setForm({ ...form, establishment_name: e.target.value });
                  if (errors.establishment_name) {
                    setErrors({ ...errors, establishment_name: '' });
                  }
                }}
                className={errors.establishment_name ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.establishment_name && (
                <p className="text-xs text-red-600 mt-1">{errors.establishment_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
                <Mail className="w-4 h-4" />
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (errors.email) {
                    setErrors({ ...errors, email: '' });
                  }
                }}
                className={errors.email ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              <p className="text-xs text-gray-500 mt-1">Use este email para acessar seu painel</p>
            </div>

            {/* Telefone */}
            <div>
              <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-4 h-4" />
                Telefone *
              </Label>
              <Input
                id="phone"
                placeholder="(85) 99999-9999"
                value={form.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setForm({ ...form, phone: formatted });
                  if (errors.phone) {
                    setErrors({ ...errors, phone: '' });
                  }
                }}
                maxLength={15}
                className={errors.phone ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              <p className="text-xs text-gray-500 mt-1">Com DDD, para notificações por WhatsApp</p>
            </div>

            <Separator className="my-4" />

            <Button type="submit" className="w-full btn-cta" disabled={isLoading} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando loja...
                </>
              ) : (
                'Criar Minha Loja'
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              ✅ Loja criada instantaneamente | 📧 Email com acesso | 🔐 Senha gerada automaticamente
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroPage;
