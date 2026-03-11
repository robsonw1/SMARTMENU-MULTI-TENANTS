import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppStatusTemplate {
  id: string;
  tenant_id: string;
  status: string;
  message_template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_TYPES = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'];

const DEFAULT_TEMPLATES: Record<string, string> = {
  pending: '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!',
  confirmed: '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min',
  preparing: '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!',
  delivering: '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min',
  delivered: '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏',
  cancelled: '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!',
};

export const useWhatsAppStatusTemplates = () => {
  const [templates, setTemplates] = useState<WhatsAppStatusTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');

  // Carregar tenant_id
  useEffect(() => {
    const storedTenantId = localStorage.getItem('admin-tenant-id');
    if (storedTenantId) {
      setTenantId(storedTenantId);
    }
  }, []);

  // Carregar templates do Supabase
  const loadTemplates = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('whatsapp_status_messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
        console.log('✅ Templates carregados:', data.length);
      } else {
        console.log('⚠️ Nenhum template encontrado, criando padrões...');
        await createDefaultTemplates();
      }
    } catch (err) {
      console.error('❌ Erro ao carregar templates:', err);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Criar templates padrão
  const createDefaultTemplates = useCallback(async () => {
    if (!tenantId) return;

    try {
      const defaultEntries = STATUS_TYPES.map((status) => ({
        tenant_id: tenantId,
        status,
        message_template: DEFAULT_TEMPLATES[status],
        enabled: true,
      }));

      const { data, error } = await (supabase as any)
        .from('whatsapp_status_messages')
        .insert(defaultEntries)
        .select();

      if (error) throw error;

      setTemplates(data || []);
      console.log('✅ Templates padrão criados');
      toast.success('Templates padrão criados com sucesso');
    } catch (err) {
      console.error('❌ Erro ao criar templates padrão:', err);
      toast.error('Erro ao criar templates padrão');
    }
  }, [tenantId]);

  // Salvar um template específico
  const saveTemplate = useCallback(
    async (templateId: string, message_template: string, enabled: boolean) => {
      try {
        setSaving(true);
        console.log(`💾 Salvando template: ${templateId}`);

        const { error } = await (supabase as any)
          .from('whatsapp_status_messages')
          .update({
            message_template,
            enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', templateId)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        // Atualizar estado local
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === templateId ? { ...t, message_template, enabled } : t
          )
        );

        console.log('✅ Template salvo com sucesso');
        return true;
      } catch (err) {
        console.error('❌ Erro ao salvar template:', err);
        toast.error('Erro ao salvar template');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tenantId]
  );

  // Sincronizar com realtime
  useEffect(() => {
    if (!tenantId) return;

    loadTemplates();

    // Subscrever a mudanças em tempo real
    const subscription = (supabase as any)
      .channel(`whatsapp_templates_${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_status_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          console.log('📲 Template atualizado por outro gerente:', payload);
          
          if (payload.eventType === 'UPDATE') {
            setTemplates((prev) =>
              prev.map((t) =>
                t.id === payload.new.id ? payload.new : t
              )
            );
            toast.info('💡 Templates foram atualizados');
          } else if (payload.eventType === 'INSERT') {
            setTemplates((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tenantId, loadTemplates]);

  return {
    templates,
    loading,
    saving,
    tenantId,
    saveTemplate,
    loadTemplates,
  };
};
