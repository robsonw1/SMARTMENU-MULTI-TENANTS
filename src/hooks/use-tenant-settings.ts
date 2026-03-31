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

// 🎯 DEFAULT SETTINGS - Usado como fallback se BD falhar
const DEFAULT_SETTINGS: TenantSettings = {
  id: '',
  tenant_id: '',
  meia_meia_enabled: true,
  imagens_enabled: true,
  adicionais_enabled: true,
  bebidas_enabled: true,
  bordas_enabled: true,
  free_ingredients_enabled: false,
  free_ingredients_max: 6,
  store_name: 'Sua Loja',
  store_description: 'Bem-vindo!',
  store_logo_url: null,
  primary_color: '#FF6B35',
  secondary_color: '#F7931E',
  timezone: 'America/Sao_Paulo',
  store_opens_at: '10:00',
  store_closes_at: '22:00',
  average_delivery_minutes: 30,
  mercadopago_enabled: false,
  pix_enabled: true,
  credit_card_enabled: true,
  whatsapp_notifications_enabled: true,
  whatsapp_phone_number: null,
  email_notifications_enabled: false,
  loyalty_enabled: true,
  loyalty_points_percentage: 0.1,
  loyalty_minimum_order: 50,
  is_active: true,
  is_maintenance: false,
  maintenance_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const useTenantSettings = (tenantId: string): UseTenantSettingsState => {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar settings inicialmente com AUTO-CREATE via RPC
  const loadSettings = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔍 [TENANT-SETTINGS] Carregando configurações para tenant: ${tenantId}`);

      // 🟢 STRATEGY: Usar RPC function ensure_tenant_settings
      // Se não existe, cria com defaults automaticamente
      const { data, error: rpcError } = await (supabase as any).rpc('ensure_tenant_settings', {
        p_tenant_id: tenantId,
      });

      if (rpcError) {
        console.warn(`⚠️  [TENANT-SETTINGS] RPC failed, usando defaults locais:`, rpcError);
        // Fallback: usar defaults locais
        setSettings({
          ...DEFAULT_SETTINGS,
          id: `temp-${Date.now()}`,
          tenant_id: tenantId,
        });
        setError(null); // Não mostrar erro, usar defaults
        return;
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn(`⚠️  [TENANT-SETTINGS] RPC retornou vazio, usando defaults`);
        setSettings({
          ...DEFAULT_SETTINGS,
          id: `temp-${Date.now()}`,
          tenant_id: tenantId,
        });
        setError(null);
        return;
      }

      // Sucesso: dados retornados pela RPC
      const settingsData = data[0] as TenantSettings;
      console.log(`✅ [TENANT-SETTINGS] Configurações carregadas via RPC:`, settingsData);
      setSettings(settingsData);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`❌ [TENANT-SETTINGS] Erro ao carregar:`, err);
      
      // Fallback: usar defaults mesmo com erro
      setSettings({
        ...DEFAULT_SETTINGS,
        id: `temp-${Date.now()}`,
        tenant_id: tenantId,
      });
      setError(null); // Não mostrar erro para usuário
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

  // Atualizar settings usando UPSERT via RPC
  const updateSettings = useCallback(
    async (updates: Partial<TenantSettings>) => {
      if (!tenantId || !settings) {
        console.error('❌ [TENANT-SETTINGS] Tenant ID ou settings não disponíveis');
        throw new Error('Tenant ID ou settings não disponíveis');
      }

      try {
        console.log(`📝 [TENANT-SETTINGS] Atualizando configurações via UPSERT:`, updates);

        // Converter updates para JSONB format
        const updatesJson = JSON.stringify(updates);

        // 🟢 Usar RPC function upsert_tenant_settings
        // Isso garante: 1) Se não existe, cria; 2) Se existe, atualiza
        const { data, error: rpcError } = await (supabase as any).rpc('upsert_tenant_settings', {
          p_tenant_id: tenantId,
          p_updates: updatesJson,
        });

        if (rpcError) {
          console.error(`❌ [TENANT-SETTINGS] UPSERT RPC falhou:`, rpcError);
          throw rpcError;
        }

        console.log(`✅ [TENANT-SETTINGS] UPSERT bem-sucedido, dados atualizados`);
        
        // Atualizar estado local imediatamente (realtime chegará depois)
        // Mesclar updates com settings existentes
        setSettings(prev => prev ? { ...prev, ...updates } : null);
        
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar configurações';
        console.error(`❌ [TENANT-SETTINGS] Erro geral ao atualizar:`, err);
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
