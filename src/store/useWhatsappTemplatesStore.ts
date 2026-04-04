import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

export interface WhatsAppTemplate {
  id: string
  tenant_id: string
  status: string
  message_template: string
  enabled: boolean
  created_at: string
  updated_at: string
}

// 7 Status fixos - NUNCA adicionar mais sem decisão arquitetônica
export type WhatsAppStatus = 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled' | 'agendado'

interface WhatsappTemplatesStore {
  // Estado
  templates: Record<WhatsAppStatus, WhatsAppTemplate | null>
  loading: boolean
  saving: boolean
  error: string | null
  cacheTimestamp: number

  // Ações
  loadTemplates: (tenantId: string) => Promise<void>
  updateTemplate: (tenantId: string, status: WhatsAppStatus, message: string, enabled?: boolean) => Promise<boolean>
  resetTemplate: (tenantId: string, status: WhatsAppStatus) => Promise<boolean>
  getTemplate: (status: WhatsAppStatus) => WhatsAppTemplate | null
  getAllTemplates: () => WhatsAppTemplate[]
  subscribeToChanges: (tenantId: string, callback: (templates: Record<WhatsAppStatus, WhatsAppTemplate | null>) => void) => () => void
  clearCache: () => void
}

const DEFAULT_TEMPLATES: Record<WhatsAppStatus, string> = {
  pending: '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!',
  confirmed: '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min',
  preparing: '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!',
  delivering: '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min',
  delivered: '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏',
  cancelled: '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!',
  agendado: '📅 Seu pedido #{pedido} foi agendado! Confirmaremos com você.',
}

const ALL_STATUSES: WhatsAppStatus[] = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'agendado']

export const useWhatsappTemplatesStore = create<WhatsappTemplatesStore>((set, get) => ({
  // Estado inicial
  templates: {
    pending: null,
    confirmed: null,
    preparing: null,
    delivering: null,
    delivered: null,
    cancelled: null,
    agendado: null,
  },
  loading: true,
  saving: false,
  error: null,
  cacheTimestamp: 0,

  // Carregar todos os 7 templates
  loadTemplates: async (tenantId: string) => {
    try {
      set({ loading: true, error: null })

      // ✅ Buscar templates com fetch + auth token Supabase
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'x-tenant-id': tenantId,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [TEMPLATES] Erro HTTP:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data: WhatsAppTemplate[] = await response.json()

      // Normalizar para Record<Status, Template>
      const normalized: Record<WhatsAppStatus, WhatsAppTemplate | null> = {
        pending: null,
        confirmed: null,
        preparing: null,
        delivering: null,
        delivered: null,
        cancelled: null,
        agendado: null,
      }

      data.forEach((template) => {
        const status = template.status as WhatsAppStatus
        if (ALL_STATUSES.includes(status)) {
          normalized[status] = template
        }
      })

      set({
        templates: normalized,
        loading: false,
        cacheTimestamp: Date.now(),
      })

      console.log('✅ Templates WhatsApp carregados com sucesso:', Object.keys(normalized).length + ' templates')
    } catch (error: any) {
      console.error('❌ Erro ao carregar templates:', error.message)
      set({ error: error.message, loading: false })
    }
  },

  // Atualizar template (UPSERT via Edge Function)
  updateTemplate: async (tenantId: string, status: WhatsAppStatus, message: string, enabled?: boolean) => {
    try {
      set({ saving: true, error: null })

      // ✅ Atualizar via fetch + auth token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-templates?status=${status}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'x-tenant-id': tenantId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_template: message,
            enabled: enabled !== undefined ? enabled : true,
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [TEMPLATES] Erro ao atualizar ${status}:`, response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const updated: WhatsAppTemplate = await response.json()

      // Atualizar estado local
      set((state) => ({
        templates: {
          ...state.templates,
          [status]: updated,
        },
        saving: false,
        cacheTimestamp: Date.now(),
      }))

      console.log(`✅ Template ${status} atualizado com sucesso`)
      return true
    } catch (error: any) {
      console.error('❌ Erro ao atualizar template:', error.message)
      set({ error: error.message, saving: false })
      return false
    }
  },

  // Reset template para padrão (soft delete + recreate)
  resetTemplate: async (tenantId: string, status: WhatsAppStatus) => {
    try {
      set({ saving: true, error: null })

      // ✅ Soft delete via fetch + auth token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-templates?status=${status}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'x-tenant-id': tenantId,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [TEMPLATES] Erro ao deletar ${status}:`, response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      // Recrear com padrão
      const defaultMessage = DEFAULT_TEMPLATES[status]
      return get().updateTemplate(tenantId, status, defaultMessage, true)
    } catch (error: any) {
      console.error('❌ Erro ao resetar template:', error.message)
      set({ error: error.message, saving: false })
      return false
    }
  },

  // Obter apenas 1 template
  getTemplate: (status: WhatsAppStatus) => {
    return get().templates[status] || null
  },

  // Obter todos os templates como array (ignore nulls)
  getAllTemplates: () => {
    return Object.values(get().templates).filter((t) => t !== null) as WhatsAppTemplate[]
  },

  // Subscribe ao realtime (via Supabase)
  subscribeToChanges: (tenantId: string, callback: (templates: Record<WhatsAppStatus, WhatsAppTemplate | null>) => void) => {
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
          const { eventType, new: newData, old: oldData } = payload

          // Atualizar estado local com os dados realtime
          set((state) => {
            const updated = { ...state.templates }
            const status = newData?.status || oldData?.status

            if (status && ALL_STATUSES.includes(status)) {
              if (eventType === 'INSERT' || eventType === 'UPDATE') {
                updated[status as WhatsAppStatus] = newData
              } else if (eventType === 'DELETE') {
                updated[status as WhatsAppStatus] = null
              }
            }

            // Chamar callback com templates atualizados
            callback(updated)

            return {
              templates: updated,
              cacheTimestamp: Date.now(),
            }
          })

          console.log(`📲 Template ${status} atualizado via realtime (${eventType})`)
        }
      )
      .subscribe()

    // Retornar função de unsubscribe
    return () => {
      subscription.unsubscribe()
    }
  },

  // Limpar cache (força reload na próxima vez)
  clearCache: () => {
    set({ cacheTimestamp: 0 })
  },
}))

// Hook de convenience: auto-load com tenant_id
export const useWhatsappTemplatesAuto = (tenantId: string) => {
  const store = useWhatsappTemplatesStore()

  // Auto-load ao montar ou quando tenant_id mudar
  const shouldLoad = tenantId && (!store.templates.pending || store.cacheTimestamp === 0)

  return {
    ...store,
    shouldLoad,
  }
}
