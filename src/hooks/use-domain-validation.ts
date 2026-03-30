import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSecureTenantId } from './use-secure-tenant-id';
import { supabase } from '@/integrations/supabase/client';

/**
 * ✅ NOVA MELHORIA (29/03/2026)
 * 
 * Hook que valida se o domínio atual corresponde ao tenant do usuário autenticado
 * Bloqueia acesso cross-domain (Ex: Admin A não consegue acessar Admin B com URL diferente)
 * 
 * Workflow:
 * 1. User faz login com smartmenu.app.aezap.site
 * 2. Tenta acessar outro-estabelecimento.app.aezap.site com mesmas credenciais
 * 3. Hook detecta: custom_domain do user (smartmenu) ≠ hostname (outro-estabelecimento)
 * 4. Redireciona: toast.error + redirect para URL correta
 * 
 * Sem quebra de funcionalidade: Funciona transparentemente no background
 */
export const useDomainValidation = () => {
  const navigate = useNavigate();
  const { tenantId: urlTenantId, isAuthenticated } = useSecureTenantId();

  useEffect(() => {
    // Rodar validação apenas se autenticado e com tenantId da URL
    if (!isAuthenticated || !urlTenantId) return;

    const validateDomain = async () => {
      try {
        // ✅ NOVO (30/03/2026): Usar sessionStorage PRIMEIRO (0ms), fallback getUser()
        let userId = sessionStorage.getItem('sb-auth-user-id');
        
        if (!userId) {
          // Fallback
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData?.user?.id) return;
          userId = userData.user.id;
        }
        
        if (!userId) return;

        // Consultar tenant_id do user autenticado
        const { data: adminUser, error } = await (supabase as any)
          .from('admin_users')
          .select('tenant_id,tenant:tenants(slug,id)')
          .eq('id', userId)
          .single();

        if (error) {
          console.warn('[useDomainValidation] Admin user não encontrado:', error);
          return;
        }

        // Obter tenant_id do user (pode estar em admin_users.tenant_id ou em relations)
        const userTenantId = adminUser?.tenant_id || adminUser?.tenant?.id;
        const userTenantSlug = adminUser?.tenant?.slug;
        
        if (!userTenantId) {
          console.warn('[useDomainValidation] tenant_id não encontrado para user');
          return;
        }

        console.log('[useDomainValidation]', {
          urlTenantId,
          userTenantId,
          userTenantSlug,
          match: urlTenantId === userTenantId || urlTenantId === userTenantSlug,
        });

        // ✅ VALIDAÇÃO: tenant_id da URL deve corresponder ao tenant do user
        // Comparar tanto by ID quanto by slug para flexibilidade
        const isValid = urlTenantId === userTenantId || urlTenantId === userTenantSlug;
        
        if (!isValid) {
          console.warn(
            `[useDomainValidation] 🚨 BLOQUEADO: URL tenant "${urlTenantId}" ≠ user tenant "${userTenantId || userTenantSlug}"`
          );

          // Toast informando o problema
          toast.error(
            `🔒 Acesso negado!`,
            {
              duration: 5000,
              description: `Você não tem permissão para acessar este estabelecimento. Acesse: ${userTenantSlug || userTenantId}.app.aezap.site`,
            }
          );

          // Redirecionar para URL correta do user
          const correctUrl = `https://${userTenantSlug || userTenantId}.app.aezap.site/admin/dashboard`;
          console.log('[useDomainValidation] Redirecionando para:', correctUrl);

          // Delay para permitir que o toast seja visto
          setTimeout(() => {
            window.location.href = correctUrl;
          }, 1500);
        } else {
          console.log(`[useDomainValidation] ✅ Validação OK: tenant "${urlTenantId}" autorizado`);
        }
      } catch (err) {
        console.error('[useDomainValidation] Erro durante validação:', err);
        // Não interromper fluxo se houver erro de validação
      }
    };

    // Executar validação após curto delay
    // Isso permite que o useSecureTenantId tenha tempo de popular o hook
    const timer = setTimeout(validateDomain, 500);

    return () => clearTimeout(timer);
  }, [urlTenantId, isAuthenticated, navigate]);

  // Hook não retorna nada - apenas executa validação
  return null;
};
