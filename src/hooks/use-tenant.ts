import { getTenantIdSync } from '@/lib/tenant-resolver';

/**
 * Hook que obtém o tenant_id
 * 
 * ✅ NOVO (30/03/2026): Usa tenant-resolver.ts
 * - Sem fetch, retorna do cache
 * - Rápido e seguro
 * - Nenhuma chamada a getSession() por aqui
 */
export const useTenant = (): { tenantId: string | null } => {
  // Obter do cache do resolver (SEM fetch)
  const tenantId = getTenantIdSync();
  
  if (!tenantId) {
    console.log('⏳ [useTenant] Tenant ID ainda não foi inicializado');
  }

  return { tenantId };
};
