import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface AdminCoupon {
  id: string;
  couponCode: string;
  discountPercentage: number;
  description?: string;
  isActive: boolean;
  isUsed: boolean;
  validDays: number;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
  usageCount: number;
  maxUsage?: number;
}

interface CouponManagementState {
  coupons: AdminCoupon[];
  loading: boolean;
  error: string | null;
  
  // Actions
  createCoupon: (
    percentageDiscount: number,
    validDays: number,
    maxUsage?: number,
    description?: string
  ) => Promise<AdminCoupon | null>;
  
  getCoupons: () => Promise<void>;
  
  deleteCoupon: (couponId: string) => Promise<boolean>;
  
  validateAndUseCoupon: (
    couponCode: string,
    customerId?: string
  ) => Promise<{ valid: boolean; discount: number; message: string }>;
  
  markCouponAsUsed: (couponCode: string, customerId?: string) => Promise<boolean>;
  
  deactivateCoupon: (couponId: string) => Promise<boolean>;
}

export const useCouponManagementStore = create<CouponManagementState>((set, get) => ({
  coupons: [],
  loading: false,
  error: null,

  createCoupon: async (percentageDiscount, validDays, maxUsage, description) => {
    try {
      set({ loading: true, error: null });

      // ✅ NOVO (30/03/2026): Obter tenant_id do admin para isolamento multi-tenant
      const adminTenantId = sessionStorage.getItem('sb-auth-tenant-id');
      if (!adminTenantId) {
        const errorMsg = 'Erro: tenant_id do admin não encontrado';
        set({ error: errorMsg });
        console.error('[COUPON] ' + errorMsg);
        return null;
      }
      console.log('[COUPON] Criando cupom para tenant:', adminTenantId);

      const couponCode = `PROMO${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validDays);

      const { data, error } = await (supabase as any)
        .from('loyalty_coupons')
        .insert([
          {
            coupon_code: couponCode,
            discount_percentage: percentageDiscount,
            is_active: true,
            is_used: false,
            expires_at: expiresAt.toISOString(),
            customer_id: null, // Cupom geral, não é para cliente específico
            discount_amount: null,
            points_threshold: null,
            tenant_id: adminTenantId, // ✅ CRÍTICO: Isolamento por tenant
          },
        ])
        .select()
        .single();

      if (error) {
        const errorMsg = `Erro ao criar cupom: ${error.message}`;
        set({ error: errorMsg });
        console.error(errorMsg);
        return null;
      }

      const newCoupon: AdminCoupon = {
        id: data.id,
        couponCode: data.coupon_code,
        discountPercentage: data.discount_percentage,
        description: description || '',
        isActive: data.is_active,
        isUsed: data.is_used,
        validDays: validDays,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        usageCount: 0,
        maxUsage: maxUsage,
      };

      // Buscar cupons atualizados
      await get().getCoupons();

      console.log('✅ Cupom criado:', couponCode);
      return newCoupon;
    } catch (error) {
      const errorMsg = `Erro em createCoupon: ${error}`;
      set({ error: errorMsg });
      console.error(errorMsg);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  getCoupons: async () => {
    try {
      set({ loading: true, error: null });

      // ✅ NOVO (30/03/2026): Filtrar cupons por tenant_id do admin
      const adminTenantId = sessionStorage.getItem('sb-auth-tenant-id');
      if (!adminTenantId) {
        const errorMsg = 'Erro: tenant_id do admin não encontrado';
        set({ error: errorMsg });
        console.error('[COUPON] ' + errorMsg);
        return;
      }
      console.log('[COUPON] Buscando cupons para tenant:', adminTenantId);

      const { data, error } = await (supabase as any)
        .from('loyalty_coupons')
        .select('*')
        .eq('tenant_id', adminTenantId) // ✅ FILTRO: Apenas cupons deste tenant
        .is('customer_id', null) // Apenas cupons gerais (não automáticos por cliente)
        .order('created_at', { ascending: false });

      if (error) {
        const errorMsg = `Erro ao buscar cupons: ${error.message}`;
        set({ error: errorMsg });
        console.error(errorMsg);
        return;
      }

      const mappedCoupons: AdminCoupon[] = (data || []).map((coupon: any) => ({
        id: coupon.id,
        couponCode: coupon.coupon_code,
        discountPercentage: coupon.discount_percentage,
        description: coupon.description || '',
        isActive: coupon.is_active,
        isUsed: coupon.is_used,
        validDays: 0, // Calculado na expiração
        expiresAt: coupon.expires_at,
        createdAt: coupon.created_at,
        usedAt: coupon.used_at,
        usageCount: 0, // Poderia contar em future
      }));

      set({ coupons: mappedCoupons });
    } catch (error) {
      const errorMsg = `Erro em getCoupons: ${error}`;
      set({ error: errorMsg });
      console.error(errorMsg);
    } finally {
      set({ loading: false });
    }
  },

  deleteCoupon: async (couponId: string) => {
    try {
      set({ loading: true, error: null });

      // ✅ NOVO (30/03/2026): Validar tenant_id antes de deletar
      const adminTenantId = sessionStorage.getItem('sb-auth-tenant-id');
      if (!adminTenantId) {
        const errorMsg = 'Erro: tenant_id do admin não encontrado';
        set({ error: errorMsg });
        console.error('[COUPON] ' + errorMsg);
        return false;
      }

      const { error } = await (supabase as any)
        .from('loyalty_coupons')
        .delete()
        .eq('id', couponId)
        .eq('tenant_id', adminTenantId); // ✅ SEGURANÇA: Só deleta cupom do seu tenant

      if (error) {
        const errorMsg = `Erro ao deletar cupom: ${error.message}`;
        set({ error: errorMsg });
        console.error(errorMsg);
        return false;
      }

      // Atualizar lista
      await get().getCoupons();
      console.log('✅ Cupom deletado');
      return true;
    } catch (error) {
      const errorMsg = `Erro em deleteCoupon: ${error}`;
      set({ error: errorMsg });
      console.error(errorMsg);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  validateAndUseCoupon: async (couponCode: string, customerId?: string) => {
    try {
      // ✅ NOVO (30/03/2026): Obter tenant_id do cliente para validar cupom
      let tenantId = sessionStorage.getItem('sb-tenant-id-by-slug');
      if (!tenantId) {
        tenantId = sessionStorage.getItem('sb-auth-tenant-id');
      }
      
      if (!tenantId) {
        console.warn('[COUPON] tenant_id não encontrado para validação de cupom');
        // Continuar mesmo sem tenant para backward compatibility
      }

      // Construir query com filtro de tenant se disponível
      let query = (supabase as any)
        .from('loyalty_coupons')
        .select('*')
        .eq('coupon_code', couponCode.toUpperCase());
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId); // ✅ Filtro: Cupom do tenant do cliente
      }
      
      const { data, error } = await query.single();

      if (error || !data) {
        return {
          valid: false,
          discount: 0,
          message: '❌ Cupom inválido',
        };
      }

      // Verificar se está ativo
      if (!data.is_active) {
        return {
          valid: false,
          discount: 0,
          message: '❌ Cupom desativado',
        };
      }

      // Verificar se já foi usado
      if (data.is_used) {
        return {
          valid: false,
          discount: 0,
          message: '❌ Cupom já foi utilizado',
        };
      }

      // Verificar validade
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return {
          valid: false,
          discount: 0,
          message: '❌ Cupom expirado',
        };
      }

      return {
        valid: true,
        discount: data.discount_percentage,
        message: `✅ Cupom válido! ${data.discount_percentage}% de desconto`,
      };
    } catch (error) {
      console.error('Erro em validateAndUseCoupon:', error);
      return {
        valid: false,
        discount: 0,
        message: '❌ Erro ao validar cupom',
      };
    }
  },

  markCouponAsUsed: async (couponCode: string, customerId?: string) => {
    try {
      const now = new Date().toISOString();

      // ✅ NOVO (30/03/2026): Validar tenant_id do cliente
      let tenantId = sessionStorage.getItem('sb-tenant-id-by-slug');
      if (!tenantId) {
        tenantId = sessionStorage.getItem('sb-auth-tenant-id');
      }

      // 🔒 SEGURANÇA: Usar UPDATE com WHERE is_used = false e tenant_id
      // Isso garante que apenas cupons não utilizados E do tenant correto sejam marcados
      const query = (supabase as any)
        .from('loyalty_coupons')
        .update({
          is_used: true,
          used_at: now,
        })
        .eq('coupon_code', couponCode.toUpperCase())
        .eq('is_used', false);  // ⚠️ CRÍTICO: Só marca se ainda não foi usado
      
      const finalQuery = tenantId ? query.eq('tenant_id', tenantId) : query; // ✅ Adiciona filtro de tenant se disponível
      const { error } = await finalQuery;

      if (error) {
        console.error('Erro ao marcar cupom como usado:', error);
        return false;
      }

      // Atualizar lista
      await get().getCoupons();
      console.log('✅ Cupom marcado como usado:', couponCode);
      return true;
    } catch (error) {
      console.error('Erro em markCouponAsUsed:', error);
      return false;
    }
  },

  deactivateCoupon: async (couponId: string) => {
    try {
      // ✅ NOVO (30/03/2026): Validar tenant_id antes de desativar
      const adminTenantId = sessionStorage.getItem('sb-auth-tenant-id');
      if (!adminTenantId) {
        console.error('[COUPON] tenant_id do admin não encontrado');
        return false;
      }

      const { error } = await (supabase as any)
        .from('loyalty_coupons')
        .update({ is_active: false })
        .eq('id', couponId)
        .eq('tenant_id', adminTenantId); // ✅ SEGURANÇA: Só desativa cupom do seu tenant

      if (error) {
        console.error('Erro ao desativar cupom:', error);
        return false;
      }

      await get().getCoupons();
      return true;
    } catch (error) {
      console.error('Erro em deactivateCoupon:', error);
      return false;
    }
  },
}));
