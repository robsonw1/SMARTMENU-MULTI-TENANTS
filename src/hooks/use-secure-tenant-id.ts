import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook SEGURO para obter tenant_id do usuário autenticado
 * 
 * ✅ VALIDA contra banco de dados (não usa localStorage)
 * ✅ Cache em memória para evitar queries repetidas
 * ✅ Designed para 1000+ lojas sem overhead
 * ✅ NOVO: Singleton pattern para evitar race conditions de múltiplas instâncias
 * 
 * DIFERENTE de localStorage - é a fonte de verdade
 */

// Cache em memória (por sessão)
const tenantCache = new Map<string, { tenantId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ✅ NOVO: Singleton - todos os hooks compartilham a mesma Promise
// Garante que getSession() é chamado apenas UMA VEZ
let sessionPromise: Promise<{ userId: string | null; error: Error | null }> | null = null;

const fetchSessionOnce = async (): Promise<{ userId: string | null; error: Error | null }> => {
  // Se já tem uma Promise em andamento, reusar
  if (sessionPromise) {
    return sessionPromise;
  }

  // Criar nova Promise que todos vão compartilhar
  sessionPromise = (async () => {
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let lastError: Error | null = null;

    while (retryCount < MAX_RETRIES) {
      try {
        retryCount++;
        console.log(`[useSecureTenantId] Fetching session (SINGLETON) - tentativa ${retryCount}/${MAX_RETRIES}`);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(`Auth error: ${sessionError.message}`);
        }

        if (!sessionData.session?.user.id) {
          console.log('[useSecureTenantId] User not authenticated (unauthenticated session)');
          return { userId: null, error: null };
        }

        console.log(`✅ [useSecureTenantId] Session obtained: ${sessionData.session.user.id}`);
        return { userId: sessionData.session.user.id, error: null };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errorMsg = lastError.message || '';

        // ✅ Se é lock stealing error e ainda temos retries, esperar e tentar novamente
        if (errorMsg.includes('Lock') && retryCount < MAX_RETRIES) {
          const waitTime = Math.pow(2, retryCount) * 300 + Math.random() * 100; // Exponential backoff: 300ms, 600ms, 1.2s...
          console.warn(`⚠️ [useSecureTenantId] Lock stealing no getSession(). Retry ${retryCount}/${MAX_RETRIES} em ${waitTime.toFixed(0)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // ❌ Outro erro ou esgotou retries
        if (retryCount >= MAX_RETRIES) {
          console.error(`❌ [useSecureTenantId] Esgotou ${MAX_RETRIES} tentativas no getSession(). Último erro:`, errorMsg);
        }
        break;
      }
    }

    // ❌ Falhou após todas as tentativas
    console.error('[useSecureTenantId] Session fetch failed after all retries:', lastError?.message);
    return { userId: null, error: lastError };
  })();

  return sessionPromise;
};

export interface UseTenantResult {
  tenantId: string | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export const useSecureTenantId = (): UseTenantResult => {
  const [result, setResult] = useState<UseTenantResult>({
    tenantId: null,
    loading: true,
    error: null,
    isAuthenticated: false,
    isAdmin: false,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchTenantIdWithRetry = async () => {
      let retryCount = 0;
      const MAX_RETRIES = 5;
      let lastError: Error | null = null;

      // ✅ Usar singleton session (chamado UMA VEZ)
      const { userId, error: sessionError } = await fetchSessionOnce();

      if (sessionError) {
        if (isMounted) {
          setResult({
            tenantId: null,
            loading: false,
            error: sessionError,
            isAuthenticated: false,
            isAdmin: false,
          });
        }
        return;
      }

      if (!userId) {
        if (isMounted) {
          setResult({
            tenantId: null,
            loading: false,
            error: null,
            isAuthenticated: false,
            isAdmin: false,
          });
        }
        return;
      }

      // ✅ Verificar cache antes de qualquer retry
      const cached = tenantCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ [useSecureTenantId] Cache HIT para ${userId}: ${cached.tenantId}`);
        if (isMounted) {
          setResult({
            tenantId: cached.tenantId,
            loading: false,
            error: null,
            isAuthenticated: true,
            isAdmin: true,
          });
        }
        return;
      }

      // ✅ Retry loop APENAS para a query ao admin_users (não reutiliza getSession)
      while (retryCount < MAX_RETRIES) {
        try {
          retryCount++;
          console.log(`[useSecureTenantId] Query admin_users tentativa ${retryCount}/${MAX_RETRIES}...`);

          const { data: adminData, error: adminError } = await (supabase as any)
            .from('admin_users')
            .select('tenant_id')
            .eq('id', userId)
            .single();

          if (adminError) {
            throw new Error(`User is not an admin or not found: ${adminError.message}`);
          }

          if (!(adminData as any)?.tenant_id) {
            throw new Error('Admin user has no tenant_id assigned');
          }

          // ✅ Sucesso! Guardar em cache com TTL
          tenantCache.set(userId, {
            tenantId: (adminData as any).tenant_id,
            timestamp: Date.now(),
          });

          if (isMounted) {
            setResult({
              tenantId: (adminData as any).tenant_id,
              loading: false,
              error: null,
              isAuthenticated: true,
              isAdmin: true,
            });
          }
          console.log(`✅ [useSecureTenantId] Sucesso! tenant_id: ${(adminData as any).tenant_id}`);
          return;  // ✅ Sucesso, sair do loop!
        } catch (err) {
          lastError = err as Error;
          const errorMsg = lastError.message || '';

          // ✅ Se é lock stealing error e ainda temos retries, esperar e tentar novamente
          if (errorMsg.includes('Lock') && retryCount < MAX_RETRIES) {
            const waitTime = Math.pow(2, retryCount) * 200 + Math.random() * 100;
            console.warn(`⚠️ [useSecureTenantId] Lock retry ${retryCount}/${MAX_RETRIES} em ${waitTime.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;  // Retry query ao admin_users
          }

          if (retryCount >= MAX_RETRIES) {
            console.error(`❌ [useSecureTenantId] Esgotou ${MAX_RETRIES} tentativas. Último erro:`, errorMsg);
          }
          break;
        }
      }

      // ❌ Falhou após todas as tentativas
      console.error('[useSecureTenantId] Final error:', lastError?.message);
      if (isMounted) {
        setResult({
          tenantId: null,
          loading: false,
          error: lastError || new Error('Unknown error'),
          isAuthenticated: false,
          isAdmin: false,
        });
      }
    };

    fetchTenantIdWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  return result;
};

/**
 * Hook para validar que um dado pertence ao tenant do usuário
 * Útil para validações no frontend antes de salvar
 */
export const useValidateTenantAccess = () => {
  const { tenantId } = useSecureTenantId();

  return {
    /**
     * Valida que recordTenantId pertence ao tenant autenticado
     */
    canAccess: (recordTenantId: string | null): boolean => {
      if (!tenantId) return false;
      if (!recordTenantId) return false;
      return recordTenantId === tenantId;
    },

    /**
     * Garante que um objeto inclui o tenant_id correto
     */
    withTenantId: <T extends Record<string, any>>(obj: T): T & { tenant_id: string } => {
      if (!tenantId) {
        throw new Error('No tenant_id available - user not authenticated');
      }
      return {
        ...obj,
        tenant_id: tenantId,
      };
    },
  };
};

/**
 * Hook para operações que SEMPRE precisam de tenant_id validado
 * Garante isolamento total para cada operação
 */
export const useWithTenantId = () => {
  const { tenantId, loading, error, isAuthenticated } = useSecureTenantId();

  return {
    tenantId,
    loading,
    error,
    isAuthenticated,

    /**
     * Builder para queries Supabase com tenant_id automático
     * Sempre filtra/inclui tenant_id - garante isolamento
     */
    withFilter: (query: any) => {
      if (!tenantId) {
        throw new Error('Tenant not authenticated - cannot apply filter');
      }
      return query.eq('tenant_id', tenantId);
    },
  };
};
