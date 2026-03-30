import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TenantRegistrationData {
  name: string;
  slug: string;
}

export const useTenantRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerTenant = async (tenantData: TenantRegistrationData) => {
    try {
      setIsLoading(true);
      setError(null);

      const { name, slug } = tenantData;

      // Validações
      if (!name || !slug) {
        setError('Preencha todos os campos');
        return null;
      }

      const cleanSlug = slug.toLowerCase().trim();

      // Validar formato do slug (apenas letras, números e hífen)
      if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
        setError('Slug inválido. Use apenas letras, números e hífen.');
        return null;
      }

      // Chamar Edge Function para criar tenant
      const response = await supabase.functions.invoke('create-tenant', {
        body: {
          name: name.trim(),
          slug: cleanSlug,
        },
      });

      if (response.error) {
        setError(response.error.message || 'Erro ao criar loja');
        return null;
      }

      const { data } = response;

      if (!data.success) {
        setError(data.error || 'Erro ao criar loja');
        return null;
      }

      toast.success(`Loja "${name}" criada com sucesso! 🎉`);
      return data.tenant;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerTenant,
    isLoading,
    error,
    setError,
  };
};
