import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface LoyaltySettings {
  id: string;
  pointsPerReal: number;
  discountPer100Points: number;
  minPointsToRedeem: number;
  bronzeMultiplier: number;
  silverMultiplier: number;
  goldMultiplier: number;
  silverThreshold: number;
  goldThreshold: number;
  signupBonusPoints: number;
  pointsExpirationDays: number;
  updatedAt: string;
}

interface LoyaltySettingsStore {
  settings: LoyaltySettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<LoyaltySettings>) => Promise<boolean>;
}

export const useLoyaltySettingsStore = create<LoyaltySettingsStore>((set, get) => ({
  settings: null,

  loadSettings: async () => {
    try {
      // Obter tenant_id da sessão (admin ou cliente)
      let tenantId = sessionStorage.getItem('sb-auth-tenant-id') || 
                     sessionStorage.getItem('sb-tenant-id-by-slug');
      
      console.log('[LOYALTY-SETTINGS] Carregando settings para tenant:', tenantId);
      
      // ✅ NOVO: Timeout para evitar travamento no mobile (3s)
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Loyalty settings timeout')), 3000)
      );

      const queryPromise = (supabase as any)
        .from('loyalty_settings')
        .select('*')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)  // Tenant-specific OR global
        .order('tenant_id', { ascending: false })  // tenant-specific first (NOT NULL)
        .limit(1);

      // Buscar settings com fallback para global default
      // Priorizar: tenant-specific > global (tenant_id IS NULL)
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]).catch(() => ({
        data: null,
        error: new Error('Timeout'),
      })) as any;

      if (error) {
        console.error('Erro ao carregar configurações de fidelização:', error);
        return;
      }

      if (data && data.length > 0) {
        const settingsRow = data[0];
        const settings: LoyaltySettings = {
          id: settingsRow.id,
          pointsPerReal: settingsRow.points_per_real || 1.0,
          discountPer100Points: settingsRow.discount_per_100_points || 5.0,
          minPointsToRedeem: settingsRow.min_points_to_redeem || 50,
          bronzeMultiplier: settingsRow.bronze_multiplier || 1.0,
          silverMultiplier: settingsRow.silver_multiplier || 1.1,
          goldMultiplier: settingsRow.gold_multiplier || 1.2,
          silverThreshold: settingsRow.silver_threshold || 500,
          goldThreshold: settingsRow.gold_threshold || 1500,
          signupBonusPoints: settingsRow.signup_bonus_points || 50,
          pointsExpirationDays: settingsRow.points_expiration_days || 365,
          updatedAt: settingsRow.updated_at,
        };

        set({ settings });
        console.log('✅ Configurações de fidelização carregadas:', {
          tenantId,
          pointsPerReal: settings.pointsPerReal,
          discountPer100Points: settings.discountPer100Points,
          isGlobal: !settingsRow.tenant_id,
        });
      } else {
        console.warn('[LOYALTY-SETTINGS] Nenhuma configuração encontrada para tenant:', tenantId);
      }
    } catch (error) {
      console.error('Erro em loadSettings:', error);
    }
  },

  updateSettings: async (updates: Partial<LoyaltySettings>) => {
    try {
      const current = get().settings;
      if (!current) {
        console.error('Nenhuma configuração carregada');
        return false;
      }

      // Mapear campos camelCase para snake_case
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.pointsPerReal !== undefined) dbUpdates.points_per_real = updates.pointsPerReal;
      if (updates.discountPer100Points !== undefined) dbUpdates.discount_per_100_points = updates.discountPer100Points;
      if (updates.minPointsToRedeem !== undefined) dbUpdates.min_points_to_redeem = updates.minPointsToRedeem;
      if (updates.bronzeMultiplier !== undefined) dbUpdates.bronze_multiplier = updates.bronzeMultiplier;
      if (updates.silverMultiplier !== undefined) dbUpdates.silver_multiplier = updates.silverMultiplier;
      if (updates.goldMultiplier !== undefined) dbUpdates.gold_multiplier = updates.goldMultiplier;
      if (updates.silverThreshold !== undefined) dbUpdates.silver_threshold = updates.silverThreshold;
      if (updates.goldThreshold !== undefined) dbUpdates.gold_threshold = updates.goldThreshold;
      if (updates.signupBonusPoints !== undefined) dbUpdates.signup_bonus_points = updates.signupBonusPoints;
      if (updates.pointsExpirationDays !== undefined) dbUpdates.points_expiration_days = updates.pointsExpirationDays;

      const { error } = await (supabase as any)
        .from('loyalty_settings')
        .update(dbUpdates)
        .eq('id', current.id);

      if (error) {
        console.error('Erro ao atualizar configurações:', error);
        return false;
      }

      // Atualizar estado local
      const updatedSettings: LoyaltySettings = {
        ...current,
        ...updates,
        updatedAt: dbUpdates.updated_at,
      };

      set({ settings: updatedSettings });
      console.log('✅ Configurações atualizadas com sucesso:', updatedSettings);
      return true;
    } catch (error) {
      console.error('Erro em updateSettings:', error);
      return false;
    }
  },
}));
