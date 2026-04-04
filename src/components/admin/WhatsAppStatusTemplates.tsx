import { useEffect, useState, useCallback } from 'react'
import { useWhatsappTemplatesStore, type WhatsAppStatus, type WhatsAppTemplate } from '@/store/useWhatsappTemplatesStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader, MessageCircle, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'

// 7 Status fixos com ícones, cores e labels
const STATUS_CONFIG: Record<WhatsAppStatus, { icon: string; label: string; color: string; description: string }> = {
  pending: {
    icon: '📋',
    label: 'Pendente',
    color: 'border-yellow-200 bg-yellow-50',
    description: 'Quando o pedido é recebido no sistema',
  },
  confirmed: {
    icon: '✅',
    label: 'Confirmado',
    color: 'border-green-200 bg-green-50',
    description: 'Quando o admin confirma o pedido',
  },
  preparing: {
    icon: '👨‍🍳',
    label: 'Preparando',
    color: 'border-blue-200 bg-blue-50',
    description: 'A pizza está sendo preparada no forno',
  },
  delivering: {
    icon: '🚗',
    label: 'Entregando',
    color: 'border-purple-200 bg-purple-50',
    description: 'O pedido saiu para entrega',
  },
  delivered: {
    icon: '🎉',
    label: 'Entregue',
    color: 'border-emerald-200 bg-emerald-50',
    description: 'Pedido entregue e finalizado',
  },
  cancelled: {
    icon: '❌',
    label: 'Cancelado',
    color: 'border-red-200 bg-red-50',
    description: 'Pedido foi cancelado pelo usuário ou admin',
  },
  agendado: {
    icon: '📅',
    label: 'Agendado',
    color: 'border-indigo-200 bg-indigo-50',
    description: 'Pedido foi agendado para mais tarde',
  },
}

const PLACEHOLDER_EXAMPLES = [
  { name: '{nome}', description: 'Nome completo do cliente', example: 'João Silva' },
  { name: '{pedido}', description: 'ID único do pedido', example: 'PED-20260331-001' },
  { name: '{hora_entrega}', description: 'Hora estimada de entrega', example: '19:30' },
]

const DEFAULT_TEMPLATES: Record<WhatsAppStatus, string> = {
  pending: '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!',
  confirmed: '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min',
  preparing: '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!',
  delivering: '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~{hora_entrega}',
  delivered: '✅ Pedido #{pedido} entregue, {nome}! Valeu pela compra 🙏',
  cancelled: '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!',
  agendado: '📅 Seu pedido #{pedido} foi agendado! Confirmaremos com você em breve.',
}

interface TemplateCardProps {
  status: WhatsAppStatus
  template: WhatsAppTemplate | null
  isEditing: boolean
  isSaving: boolean
  onEdit: (status: WhatsAppStatus) => void
  onSave: (status: WhatsAppStatus, message: string, enabled: boolean) => Promise<void>
  onCancel: () => void
  onReset: (status: WhatsAppStatus) => Promise<void>
}

/**
 * TemplateCard: Um card para cada um dos 7 status fixos
 * UPSERT Pattern: clica em "Editar" → altera → clica em "Salvar"
 * Soft delete: toggle enabled=false para desativar
 * Reset: volta ao padrão predefinido
 */
const TemplateCard: React.FC<TemplateCardProps> = ({
  status,
  template,
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onReset,
}) => {
  const config = STATUS_CONFIG[status]
  const [editMessage, setEditMessage] = useState(template?.message_template ?? DEFAULT_TEMPLATES[status])
  const [editEnabled, setEditEnabled] = useState(template?.enabled ?? true)

  // Sincronizar quando template muda (realtime updates)
  useEffect(() => {
    if (template) {
      setEditMessage(template.message_template)
      setEditEnabled(template.enabled)
    }
  }, [template])

  const handleSave = async () => {
    if (!editMessage.trim()) {
      toast.error('Mensagem não pode estar vazia')
      return
    }
    await onSave(status, editMessage, editEnabled)
  }

  return (
    <Card className={`border-2 transition-all ${config.color} ${isEditing ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-3xl">{config.icon}</span>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {config.label}
                {!editEnabled && !isEditing && (
                  <span className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded font-medium">
                    Desativado
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1">{config.description}</CardDescription>
            </div>
          </div>

          {/* Toggle Enable/Disable */}
          <div className="flex flex-col items-center gap-1">
            <Switch
              checked={editEnabled}
              onCheckedChange={setEditEnabled}
              disabled={!isEditing || isSaving}
              aria-label={`${config.label} - Ativar/Desativar`}
            />
            <span className="text-xs text-muted-foreground">{editEnabled ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preview ou Editor */}
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`template-${status}`} className="text-sm font-medium">
                Conteúdo do Template
              </Label>
              <Textarea
                id={`template-${status}`}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="min-h-[120px] resize-none font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                {editMessage.length} caracteres (WhatsApp limite: 4096)
              </p>
            </div>

            {/* Placeholders Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-900">📌 Placeholders Disponíveis:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLACEHOLDER_EXAMPLES.map((placeholder) => (
                  <div key={placeholder.name} className="text-xs bg-white rounded p-2 border border-blue-100">
                    <code className="block text-blue-600 font-mono font-bold">{placeholder.name}</code>
                    <span className="text-blue-700">{placeholder.description}</span>
                    <span className="text-blue-500 text-xs block mt-1">Ex: {placeholder.example}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões Edição */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="flex-1 gap-2"
                variant="default"
              >
                {isSaving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </Button>
              <Button
                onClick={onCancel}
                disabled={isSaving}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => onReset(status)}
                disabled={isSaving}
                variant="ghost"
                size="sm"
                className="gap-1"
                title="Restaurar template padrão"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div className="bg-white border rounded-lg p-3 min-h-[100px] flex items-center">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{editMessage}</p>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-muted-foreground">
              {template ? (
                <>
                  <span>✏️ Atualizado {new Date(template.updated_at).toLocaleDateString('pt-BR')}</span>
                  <span className="ml-2">às {new Date(template.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              ) : (
                <span className="text-yellow-600">⚠️ Template não salvo ainda</span>
              )}
            </div>

            {/* Edit Button */}
            <Button
              onClick={() => onEdit(status)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Editar Template
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * WhatsAppStatusTemplates: Painel Admin com 7 cards fixos
 * Grid responsivo: 1 coluna mobile, 2 colunas tablet, 3 colunas desktop
 */
export const WhatsAppStatusTemplates = () => {
  const store = useWhatsappTemplatesStore()
  const [tenantId, setTenantId] = useState<string>('')
  const [editingStatus, setEditingStatus] = useState<WhatsAppStatus | null>(null)
  const [resetting, setResetting] = useState<WhatsAppStatus | null>(null)

  // Obter tenant_id e carregar templates
  useEffect(() => {
    // ✅ Validação: buscar tenantId com prioridade
    const id =
      sessionStorage.getItem('sb-auth-tenant-id') ||
      sessionStorage.getItem('sb-tenant-id-by-slug') ||
      localStorage.getItem('admin-tenant-id')

    // ✅ Validar que tenantId é válido
    if (id && id.trim() !== '') {
      console.log('🔑 [NOTIFICATIONS] Tenant identificado:', id.substring(0, 8) + '...')
      setTenantId(id)
      
      // ✅ Carregar templates com delay mínimo para garantir estado
      setTimeout(() => {
        store.loadTemplates(id)
      }, 100)

      // Subscrever a mudanças realtime
      const unsubscribe = store.subscribeToChanges(id, () => {
        console.log('🔄 [NOTIFICATIONS] Templates atualizados em tempo real')
        toast.info('💡 Templates atualizados em tempo real')
      })

      return () => unsubscribe()
    } else {
      console.warn('⚠️ [NOTIFICATIONS] tenantId não encontrado em sessionStorage/localStorage')
      setTenantId('')
    }
  }, [store])

  // Handlers
  const handleEdit = useCallback((status: WhatsAppStatus) => {
    setEditingStatus(status)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingStatus(null)
  }, [])

  const handleSave = useCallback(
    async (status: WhatsAppStatus, message: string, enabled: boolean) => {
      if (!tenantId) {
        toast.error('Tenant não identificado')
        return
      }

      const success = await store.updateTemplate(tenantId, status, message, enabled)
      if (success) {
        setEditingStatus(null)
        toast.success(`✅ Template ${STATUS_CONFIG[status].label} salvo com sucesso`)
      }
    },
    [tenantId, store]
  )

  const handleReset = useCallback(
    async (status: WhatsAppStatus) => {
      if (!tenantId) {
        toast.error('Tenant não identificado')
        return
      }

      setResetting(status)
      try {
        // Soft delete + recri ate with default
        await store.resetTemplate(tenantId, status)
        toast.success(`✅ Template ${STATUS_CONFIG[status].label} resetado para padrão`)
      } finally {
        setResetting(null)
      }
    },
    [tenantId, store]
  )

  if (store.loading && Object.values(store.templates).every((t) => !t)) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center justify-center gap-4">
          <Loader className="w-10 h-10 animate-spin text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">Carregando Templates...</p>
            <p className="text-sm text-muted-foreground">Aguarde enquanto sincronizamos com seu banco de dados</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Templates de WhatsApp</h2>
        </div>
        <p className="text-muted-foreground max-w-xl">
          Personalize as 7 mensagens que seus clientes recebem por WhatsApp conforme o status do pedido avança. 
          Use os placeholders para inserir dados dinâmicos como nome e ID do pedido.
        </p>
      </div>

      {/* Performance Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
        <span className="font-semibold">⚡ Opção A - UI Fixa 7 Slots:</span> O(1) performance, cache eficiente, RLS simples, escalável para 10k+ tenants
      </div>

      {/* 7 Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
        {(Object.keys(STATUS_CONFIG) as WhatsAppStatus[]).map((status) => (
          <TemplateCard
            key={status}
            status={status}
            template={store.templates[status]}
            isEditing={editingStatus === status}
            isSaving={store.saving || resetting === status}
            onEdit={handleEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onReset={handleReset}
          />
        ))}
      </div>

      {/* Info Footer */}
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-2">
          <p>
            <span className="font-semibold text-slate-900">💾 Auto-Save:</span> Templates são salvos imediatamente quando você clica "Salvar"
          </p>
          <p>
            <span className="font-semibold text-slate-900">🔄 Realtime Sync:</span> Se outro gerente editar um template, você verá a atualização em tempo real
          </p>
          <p>
            <span className="font-semibold text-slate-900">🔒 Isolado por Tenant:</span> Cada pizzeria vê apenas seus próprios templates
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

