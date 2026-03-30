import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTenantRegistration } from '@/hooks/use-tenant-registration';
import { ArrowLeft, Store } from 'lucide-react';

const RegisterTenantPage = () => {
  const navigate = useNavigate();
  const { registerTenant, isLoading, error, setError } = useTenantRegistration();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [justCreated, setJustCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !slug) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    const result = await registerTenant({ name, slug });

    if (result) {
      setName('');
      setSlug('');
      setJustCreated(true);

      setTimeout(() => {
        setJustCreated(false);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"
        >
          <ArrowLeft size={20} />
          Voltar para Dashboard
        </button>

        <Card className="bg-slate-900 border-gray-700">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <Store size={28} className="text-orange-500" />
              <CardTitle className="text-2xl">Criar Nova Loja</CardTitle>
            </div>
            <CardDescription>
              Registre uma nova loja no sistema.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">
                  Nome da Loja *
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Pizzaria Forneiro Eden"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="bg-slate-800 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-white">
                  Slug (Subdomínio) *
                </Label>
                <div className="flex items-center">
                  <Input
                    id="slug"
                    placeholder="ex: pizzaria-forneiro"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setError(null);
                    }}
                    disabled={isLoading}
                    className="bg-slate-800 border-gray-600 text-white rounded-r-none"
                  />
                  <span className="bg-slate-800 border border-l-0 border-gray-600 px-3 py-2 text-gray-400 text-sm rounded-r-md">
                    .app.aezap.site
                  </span>
                </div>
              </div>

              {slug && (
                <div className="bg-slate-800 border border-gray-600 rounded-md p-3">
                  <p className="text-xs text-gray-400 mb-1">Acesso em:</p>
                  <p className="text-sm font-mono text-orange-500">
                    https://{slug}.app.aezap.site
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-md p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {justCreated && (
                <div className="bg-green-900/20 border border-green-700 rounded-md p-3">
                  <p className="text-sm text-green-400">✅ Loja criada!</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isLoading || !name || !slug}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isLoading ? 'Criando...' : 'Criar Loja'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex-1 border-gray-600 text-white hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterTenantPage;
