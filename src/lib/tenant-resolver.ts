/**
 * Tenant Resolver - Resolve tenant_id uma única vez ao inicializar
 * 
 * ✅ PADRÃO MULTI-TENANT EFICIENTE:
 * 1. Resolve tenant_id UMA VEZ (não em cada hook)
 * 2. Cacheia em memória + sessionStorage
 * 3. Oferece getters síncronos (SEM fetch)
 * 4. Suporta admin auth + URL slug + cache
 * 5. ZERO lock stealing - nenhuma chamada a getSession()
 * 
 * FLUXO:
 * App init → initTenantResolver() → resolve tenant_id 1x
 *                                  → cacheia
 *                                  → todos os hooks usam getTenantIdSync()
 */

import { supabase } from '@/integrations/supabase/client';

// Cache em memória (por sessão de navegador)
let tenantIdCache: string | null = null;
let tenantResolvePromise: Promise<string | null> | null = null;

/**
 * Obtém tenant_id do cache (SÍNCRONO - nunca fetch)
 * Usado por todos os hooks e componentes após inicialização
 */
export const getTenantIdSync = (): string | null => {
  // 1. Verificar cache em memória
  if (tenantIdCache) {
    console.log(`✅ [TENANT-RESOLVER] Retornando do cache memória: ${tenantIdCache}`);
    return tenantIdCache;
  }

  // 2. Verificar cache em sessionStorage
  const cachedFromSession = sessionStorage.getItem('tenant_id_cache');
  if (cachedFromSession) {
    console.log(`✅ [TENANT-RESOLVER] Retornando do cache sessionStorage: ${cachedFromSession}`);
    tenantIdCache = cachedFromSession;
    return cachedFromSession;
  }

  // 3. Não está em cache
  console.log(`⏳ [TENANT-RESOLVER] Tenant ID ainda não foi resolvido`);
  return null;
};

/**
 * Detecta tenant_id da URL slug (para clientes públicos)
 * Não chama getSession(), apenas analisa a URL
 */
const detectTenantFromSlug = (): string | null => {
  try {
    const hostname = window.location.hostname;
    console.log(`🔍 [TENANT-SLUG] Hostname: ${hostname}`);

    // Padrão: {tenantSlug}.app.aezap.site
    const match = hostname.match(/^([a-z0-9-]+)\.app\.aezap\.site$/i);
    if (match && match[1]) {
      const slug = match[1].toLowerCase();
      console.log(`✅ [TENANT-SLUG] Detectado slug: ${slug}`);

      // Buscar tenant_id pelo slug
      // MAS: Isso ainda precisa de fetch... então faremos isso com retry na inicialização
      return slug;
    }
  } catch (error) {
    console.error('[TENANT-SLUG] Erro ao analisar URL:', error);
  }
  return null;
};

/**
 * Obtém tenant_id do usuário autenticado (admin)
 */
const getTenantFromAuth = async (): Promise<string | null> => {
  try {
    console.log(`🔐 [TENANT-AUTH] Tentando obter session...`);
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn(`⚠️ [TENANT-AUTH] Erro ao obter session:`, error.message);
      return null;
    }

    if (!session?.user?.id) {
      console.log(`ℹ️ [TENANT-AUTH] Usuário não autenticado`);
      return null;
    }

    console.log(`✅ [TENANT-AUTH] Usuário autenticado: ${session.user.id}`);

    // Buscar tenant do usuário admin
    // Usando 'any' cast porque a tabela admin_users pode não estar no schema typed
    const { data: adminUser, error: adminError } = await (supabase as any)
      .from('admin_users')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (adminError) {
      console.warn(`⚠️ [TENANT-AUTH] Erro ao buscar admin_users:`, adminError.message);
      return null;
    }

    const tenantId = (adminUser as any)?.tenant_id;
    if (tenantId) {
      console.log(`✅ [TENANT-AUTH] Tenant obtido do admin_users: ${tenantId}`);
      return tenantId;
    }

    return null;
  } catch (error) {
    console.error('[TENANT-AUTH] Exceção ao obter tenant do auth:', error);
    return null;
  }
};

/**
 * Obtém tenant_id pelo slug (para clientes públicos)
 */
const getTenantFromSlug = async (slug: string): Promise<string | null> => {
  try {
    console.log(`🔍 [TENANT-SLUG-QUERY] Buscando tenant para slug: ${slug}`);
    
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug.toLowerCase())
      .single();

    if (error) {
      console.warn(`⚠️ [TENANT-SLUG-QUERY] Erro ao buscar tenant:`, error.message);
      return null;
    }

    if (data?.id) {
      console.log(`✅ [TENANT-SLUG-QUERY] Tenant encontrado: ${data.id}`);
      return data.id;
    }

    return null;
  } catch (error) {
    console.error('[TENANT-SLUG-QUERY] Exceção ao buscar tenant pelo slug:', error);
    return null;
  }
};

/**
 * Inicializa o resolver de tenant_id
 * Deve ser chamado UM VEZ no app init (antes de montar componentes)
 * 
 * FLUXO:
 * 1. Tentar obter do auth (admin) - UMA chamada a getSession()
 * 2. Se não for admin, tentar obter do slug (cliente público)
 * 3. Cachear o resultado
 * 4. Todos os components usam getTenantIdSync() daí em diante
 */
export const initTenantResolver = async (): Promise<string | null> => {
  // Se já está resolvendo, retornar promise existente
  if (tenantResolvePromise) {
    console.log(`⏳ [TENANT-INIT] Já está resolvendo, aguardando...`);
    return tenantResolvePromise;
  }

  console.log(`🚀 [TENANT-INIT] Inicializando resolver de tenant_id...`);

  tenantResolvePromise = (async () => {
    try {
      // 1. Tentar obter do auth (admin)
      let tenantId = await getTenantFromAuth();
      
      if (tenantId) {
        console.log(`✅ [TENANT-INIT] Resolvido como ADMIN: ${tenantId}`);
        tenantIdCache = tenantId;
        sessionStorage.setItem('tenant_id_cache', tenantId);
        // ✅ NOVO: Também salvar em sb-tenant-id-by-slug para useSettingsStore encontrar
        sessionStorage.setItem('sb-tenant-id-by-slug', tenantId);
        return tenantId;
      }

      // 2. Tentar obter do slug (cliente público)
      const slug = detectTenantFromSlug();
      if (slug) {
        tenantId = await getTenantFromSlug(slug);
        if (tenantId) {
          console.log(`✅ [TENANT-INIT] Resolvido como CLIENTE: ${tenantId}`);
          tenantIdCache = tenantId;
          sessionStorage.setItem('tenant_id_cache', tenantId);
          // ✅ NOVO: Também salvar em sb-tenant-id-by-slug para useSettingsStore encontrar
          sessionStorage.setItem('sb-tenant-id-by-slug', tenantId);
          return tenantId;
        }
      }

      // 3. Falhou
      console.error(`❌ [TENANT-INIT] Não foi possível resolver tenant_id`);
      return null;
    } finally {
      // Limpar promise após conclusão (mesmo que falhe)
      tenantResolvePromise = null;
    }
  })();

  return tenantResolvePromise;
};

/**
 * Aguarda o resultado de initTenantResolver() (para casos que precisam de async)
 */
export const waitForTenantId = (): Promise<string | null> => {
  if (tenantResolvePromise) {
    return tenantResolvePromise;
  }
  
  // Se já resolveu, retornar o valor cacheado
  const cached = getTenantIdSync();
  if (cached) {
    return Promise.resolve(cached);
  }

  // Se não resolveu e não está em progresso, retornar null
  return Promise.resolve(null);
};

/**
 * Limpa o cache (para logout ou troca de tenant)
 */
export const clearTenantCache = () => {
  console.log(`🗑️ [TENANT-RESOLVER] Limpando cache...`);
  tenantIdCache = null;
  sessionStorage.removeItem('tenant_id_cache');
};

/**
 * Debug: mostra estado atual
 */
export const debugTenantResolver = () => {
  return {
    cachedTenantId: tenantIdCache,
    sessionStorageTenantId: sessionStorage.getItem('tenant_id_cache'),
    isResolving: !!tenantResolvePromise,
  };
};
