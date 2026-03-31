import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantSettings {
  id: string;
  tenant_id: string;
  
  // Cardápio
  meia_meia_enabled: boolean;
  imagens_enabled: boolean;
  adicionais_enabled: boolean;
  bebidas_enabled: boolean;
  bordas_enabled: boolean;
  
  // Customizações
  free_ingredients_enabled: boolean;
  free_ingredients_max: number;
  
  // Branding
  store_name: string;
  store_description: string;
  store_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  
  // Localização
  timezone: string;
  store_opens_at: string;
  store_closes_at: string;
  average_delivery_minutes: number;
  
  // Pagamentos
  mercadopago_enabled: boolean;
  pix_enabled: boolean;
  credit_card_enabled: boolean;
  
  // Notificações
  whatsapp_notifications_enabled: boolean;
  whatsapp_phone_number: string | null;
  email_notifications_enabled: boolean;
  
  // Fidelização
  loyalty_enabled: boolean;
  loyalty_points_percentage: number;
  loyalty_minimum_order: number;
  
  // Status
  is_active: boolean;
  is_maintenance: boolean;
  maintenance_message: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

interface UseTenantSettingsState {
  settings: TenantSettings | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<TenantSettings>) => Promise<void>;
}

export const useTenantSettings = (tenantId: string): UseTenantSettingsState => {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar settings inicialmente
  const loadSettings = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔍 [TENANT-SETTINGS] Carregando configurações para tenant: ${tenantId}`);
      
      // DEBUG: Log auth context
      const { data: { user } } = await supabase.auth.getUser();
      console.log(`🔐 [TENANT-SETTINGS] Auth User ID:`, user?.id);
      console.log(`🔐 [TENANT-SETTINGS] Tenant ID:`, tenantId);

      const { data, error: fetchError } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        console.error(`❌ [TENANT-SETTINGS] Erro ao carregar:`, fetchError);
        console.error(`❌ [TENANT-SETTINGS] Código erro: ${fetchError.code}`);
        console.error(`❌ [TENANT-SETTINGS] Detalhes: ${JSON.stringify(fetchError.details)}`);
        setError(fetchError.message);
        return;
      }

      console.log(`✅ [TENANT-SETTINGS] Configurações carregadas:`, data);
      setSettings(data as TenantSettings);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`❌ [TENANT-SETTINGS] Erro geral:`, err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Sincronização realtime
  useEffect(() => {
    loadSettings();

    if (!tenantId) return;

    console.log(`📡 [TENANT-SETTINGS] Iniciando sincronização realtime para: ${tenantId}`);

    // Subscribe a atualizações em tempo real
    const channel = supabase
      .channel(`tenant-settings:${tenantId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: 'user' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_settings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          console.log(`🔄 [TENANT-SETTINGS] Atualização realtime:`, payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setSettings(payload.new as TenantSettings);
            console.log(`✅ [TENANT-SETTINGS] Settings atualizadas em tempo real`);
          } else if (payload.eventType === 'DELETE') {
            console.warn(`⚠️  [TENANT-SETTINGS] Settings foram deletadas`);
            setSettings(null);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📊 [TENANT-SETTINGS] Realtime subscription status: ${status}`);
      });

    return () => {
      console.log(`🛑 [TENANT-SETTINGS] Unsubscribing realtime para: ${tenantId}`);
      channel.unsubscribe();
    };
  }, [tenantId, loadSettings]);

  // Atualizar settings
  const updateSettings = useCallback(
    async (updates: Partial<TenantSettings>) => {
      if (!tenantId || !settings) {
        console.error('❌ [TENANT-SETTINGS] Tenant ID ou settings não disponíveis');
        throw new Error('Tenant ID ou settings não disponíveis');
      }

      try {
        console.log(`📝 [TENANT-SETTINGS] Atualizando configurações:`, updates);

        const { data, error: updateError } = await supabase
          .from('tenant_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (updateError) {
          console.error(`❌ [TENANT-SETTINGS] Erro ao atualizar:`, updateError);
          throw updateError;
        }

        console.log(`✅ [TENANT-SETTINGS] Configurações atualizadas com sucesso:`, data);
        
        // Atualização local imediata (realtime chegará depois)
        setSettings(data as TenantSettings);
        
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar configurações';
        console.error(`❌ [TENANT-SETTINGS] Erro geral:`, err);
        throw new Error(message);
      }
    },
    [tenantId, settings]
  );

  return {
    settings,
    isLoading,
    error,
    updateSettings,
  };
};
