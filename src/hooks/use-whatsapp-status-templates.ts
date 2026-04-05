import { useState, useEffect, useCallback } from 'react'
import { useWhatsappTemplatesStore, type WhatsAppTemplate, type WhatsAppStatus } from '@/store/useWhatsappTemplatesStore'
import { toast } from 'sonner'

/**
 * Hook de compatibilidade para componentes legados
 * Mantém a interface antiga enquanto usa o novo store por baixo
 * Útil para migração gradual
 */
export interface WhatsAppStatusTemplate {
  id: string
  tenant_id: string
  status: string
  message_template: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export const useWhatsAppStatusTemplates = () => {
  const store = useWhatsappTemplatesStore()
  const [templates, setTemplates] = useState<WhatsAppStatusTemplate[]>([])
  const [tenantId, setTenantId] = useState<string>('')

  // Obter tenant_id da sessão
  useEffect(() => {
    const storedTenantId =
      sessionStorage.getItem('sb-auth-tenant-id') ||
      sessionStorage.getItem('sb-tenant-id-by-slug') ||
      localStorage.getItem('admin-tenant-id')

    if (storedTenantId) {
      setTenantId(storedTenantId)
    }
  }, [])

  // Carregar templates quando tenant_id muda
  useEffect(() => {
    if (!tenantId) return

    const loadAndSubscribe = async () => {
      // Carregar templates do store
      await store.loadTemplates(tenantId)

      // Inscrever-se a mudanças realtime
      const unsubscribe = store.subscribeToChanges(tenantId, (updatedTemplates) => {
        // Converter para array format para compatibilidade
        const arr = Object.values(updatedTemplates)
          .filter((t) => t !== null)
          .map((t) => t as WhatsAppTemplate)

        setTemplates(arr)
        if (arr.length > 0) {
          toast.info('💡 Templates atualizados em tempo real')
        }
      })

      // Converter templates do store para array format
      const arr = store.getAllTemplates()
      setTemplates(arr)

      return unsubscribe
    }

    let unsubscribe: (() => void) | undefined

    loadAndSubscribe().then((fn) => {
      unsubscribe = fn
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [tenantId, store])

  // Salvar um template (usa store por baixo)
  const saveTemplate = useCallback(
    async (templateId: string, message_template: string, enabled: boolean) => {
      if (!tenantId) {
        toast.error('Tenant não identificado')
        return false
      }

      try {
        // Encontrar o status do template pelo ID
        const template = store.getAllTemplates().find((t) => t.id === templateId)
        if (!template) {
          toast.error('Template não encontrado')
          return false
        }

        const success = await store.updateTemplate(
          tenantId,
          template.status as WhatsAppStatus,
          message_template,
          enabled
        )

        if (success) {
          toast.success('✅ Template salvo com sucesso')
        }

        return success
      } catch (error: any) {
        console.error('❌ Erro ao salvar template:', error)
        toast.error('Erro ao salvar template')
        return false
      }
    },
    [tenantId, store]
  )

  return {
    templates,
    loading: store.loading,
    saving: store.saving,
    tenantId,
    saveTemplate,
    loadTemplates: () => store.loadTemplates(tenantId),
  }
}
