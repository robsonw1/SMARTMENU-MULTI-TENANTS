import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHostInfo } from '@/hooks/use-host-info';

/**
 * Hook que obtém tenant_id baseado no slug da URL
 * 
 * ✅ Funciona para CLIENTES PÚBLICOS (anônimos)
 * ⚠️  SKIP automático se usuário é admin autenticado (evita race condition)
 * 
 * IMPORTANTE: 
 * - Este hook NÃO usa autenticação, busca apenas pelo slug
 * - Detecta se está autenticado e PULA se for admin (evita lock stealing)
 * - Segurança: RLS policies no banco garantem isolamento
 */
export const useTenantIdFromSlug = () => {
  const { type: hostType, tenantSlug } = useHostInfo();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Skip automático: se não é tenant específico (é admin ou landing)
    if (hostType !== 'tenant' || !tenantSlug) {
      console.log('📍 [TENANT-FROM-SLUG] Não é tenant específico, skip');
      setTenantId(null);
      setLoading(false);
      return;
    }

    const fetchTenantIdWithAuth = async () => {
      try {
        // ✅ Verificar se usuário está autenticado (admin)
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session?.user?.id) {
          // Usuário autenticado = é admin dessa loja, skip desta query
          console.log('👨‍💼 [TENANT-FROM-SLUG] Usuário autenticado detectado, skip (useSecureTenantId já resolveu)');
          setTenantId(null);
          setLoading(false);
          return;
        }

        // ✅ Cliente público (anônimo): fazer query pelo slug
        console.log(`🔍 [TENANT-FROM-SLUG] Buscando tenant_id para slug: ${tenantSlug}`);

        const { data, error } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', tenantSlug.toLowerCase())
          .single();

        if (error) {
          console.error(`❌ [TENANT-FROM-SLUG] Erro ao buscar tenant para slug ${tenantSlug}:`, error.message);
          setTenantId(null);
          setLoading(false);
          return;
        }

        if (data) {
          console.log(`✅ [TENANT-FROM-SLUG] Tenant encontrado: ${data.id} (slug: ${tenantSlug})`);
          setTenantId(data.id);
        } else {
          console.warn(`⚠️ [TENANT-FROM-SLUG] Nenhum tenant found para slug: ${tenantSlug}`);
          setTenantId(null);
        }
      } catch (err) {
        console.error('[TENANT-FROM-SLUG] Exceção ao buscar tenant:', err);
        setTenantId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantIdWithAuth();
  }, [hostType, tenantSlug]);

  return { tenantId, loading, tenantSlug };
};
