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
  isUsingDefaults: boolean;
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
  const [isUsingDefaults, setIsUsingDefaults] = useState(false);

  // Carregar settings inicialmente com AUTO-CREATE via RPC
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Se tenantId vazio, usar defaults imediatamente
      if (!tenantId) {
        console.warn(`⚠️  [TENANT-SETTINGS] TenantId vazio, usando defaults`);
        setSettings({
          ...DEFAULT_SETTINGS,
          id: `temp-${Date.now()}`,
          tenant_id: '',
        });
        setIsUsingDefaults(true);
        setIsLoading(false);
        return;
      }

      console.log(`🔍 [TENANT-SETTINGS] Carregando configurações para tenant: ${tenantId}`);

      // 🟢 STRATEGY 1: Tentar QUERY DIRETA primeiro (mais rápido)
      const { data: existingData, error: queryError } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (!queryError && existingData) {
        // ✅ Sucesso: dados existem no BD
        console.log(`✅ [TENANT-SETTINGS] Dados encontrados:`, existingData);
        setSettings(existingData as TenantSettings);
        setIsUsingDefaults(false);
        setIsLoading(false);
        return;
      }

      console.log(`⚠️  [TENANT-SETTINGS] Dados não encontrados, tentando RPC auto-create...`);

      // 🟢 STRATEGY 2: Se não existe, tentar RPC para criar
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'ensure_tenant_settings',
        { p_tenant_id: tenantId }
      );

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        // ✅ RPC criou/retornou dados
        console.log(`✅ [TENANT-SETTINGS] Auto-criado via RPC:`, rpcData[0]);
        setSettings(rpcData[0] as TenantSettings);
        setIsUsingDefaults(false);
        setIsLoading(false);
        return;
      }

      console.warn(`⚠️  [TENANT-SETTINGS] RPC falhou ou está indisponível, usando defaults:`, rpcError);

      // 🟢 STRATEGY 3: Fallback para defaults locais
      // Nota: tenant_id estará vazio até que user salvar (OK por enquanto)
      const defaultSettingsWithTenant = {
        ...DEFAULT_SETTINGS,
        id: `temp-${Date.now()}`,
        tenant_id: tenantId,
      };

      setSettings(defaultSettingsWithTenant);
      setIsUsingDefaults(true);
      setError(null); // NUNCA mostrar erro para usuário
      setIsLoading(false);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`❌ [TENANT-SETTINGS] Erro geral:`, err);
      
      // Fallback: usar defaults mesmo com erro
      setSettings({
        ...DEFAULT_SETTINGS,
        id: `temp-${Date.now()}`,
        tenant_id: tenantId,
      });
      setIsUsingDefaults(true);
      setError(null); // Não mostrar erro para usuário
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

  // Atualizar settings com UPSERT automático
  const updateSettings = useCallback(
    async (updates: Partial<TenantSettings>) => {
      if (!tenantId || !settings) {
        console.error('❌ [TENANT-SETTINGS] Tenant ID ou settings não disponíveis');
        throw new Error('Tenant ID ou settings não disponíveis');
      }

      try {
        console.log(`📝 [TENANT-SETTINGS] Atualizando configurações:`, updates);

        // 🟢 STRATEGY 1: Tentar UPDATE direto
        const { data: updateData, error: updateError, count } = await supabase
          .from('tenant_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (!updateError && updateData) {
          // ✅ UPDATE bem-sucedido
          console.log(`✅ [TENANT-SETTINGS] UPDATE bem-sucedido:`, updateData);
          setSettings(updateData as TenantSettings);
          setIsUsingDefaults(false);
          return;
        }

        console.log(`⚠️  [TENANT-SETTINGS] UPDATE falhou (talvez não exista), tentando INSERT...`);

        // 🟢 STRATEGY 2: Se UPDATE falhou, tentar INSERT (UPSERT)
        const { data: insertData, error: insertError } = await supabase
          .from('tenant_settings')
          .insert({
            tenant_id: tenantId,
            ...updates,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!insertError && insertData) {
          // ✅ INSERT bem-sucedido
          console.log(`✅ [TENANT-SETTINGS] INSERT bem-sucedido:`, insertData);
          setSettings(insertData as TenantSettings);
          setIsUsingDefaults(false);
          return;
        }

        console.error(`❌ [TENANT-SETTINGS] INSERT também falhou`, insertError);
        throw insertError || updateError || new Error('Não conseguiu atualizar/inserir');

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
    isUsingDefaults,
    updateSettings,
  };
};
