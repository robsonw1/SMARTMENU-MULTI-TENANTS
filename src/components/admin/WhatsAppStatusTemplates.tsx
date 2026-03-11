import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Loader, MessageCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsAppStatusTemplates, WhatsAppStatusTemplate } from '@/hooks/use-whatsapp-status-templates';

// Status com ícones e cores
const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  pending: { icon: '📋', label: 'Pendente', color: 'bg-yellow-50' },
  confirmed: { icon: '✅', label: 'Confirmado', color: 'bg-green-50' },
  preparing: { icon: '👨‍🍳', label: 'Preparando', color: 'bg-blue-50' },
  delivering: { icon: '🚗', label: 'Entregando', color: 'bg-purple-50' },
  delivered: { icon: '✅', label: 'Entregue', color: 'bg-green-100' },
  cancelled: { icon: '❌', label: 'Cancelado', color: 'bg-red-50' },
};

const PLACEHOLDERS = [
  { name: '{nome}', description: 'Nome do cliente' },
  { name: '{pedido}', description: 'ID do pedido' },
];

export const WhatsAppStatusTemplates = () => {
  const { templates, loading, saving, saveTemplate } = useWhatsAppStatusTemplates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { template: string; enabled: boolean }>>({});

  // Inicializar valores de edição
  const initializeEdit = useCallback((template: WhatsAppStatusTemplate) => {
    if (!editValues[template.id]) {
      setEditValues((prev) => ({
        ...prev,
        [template.id]: {
          template: template.message_template,
          enabled: template.enabled,
        },
      }));
    }
  }, [editValues]);

  // Salvar template
  const handleSave = useCallback(
    async (templateId: string) => {
      const values = editValues[templateId];
      if (!values) return;

      if (!values.template.trim()) {
        toast.error('Mensagem não pode estar vazia');
        return;
      }

      const success = await saveTemplate(templateId, values.template, values.enabled);
      if (success) {
        setEditingId(null);
        toast.success('✅ Template salvo com sucesso');
      }
    },
    [editValues, saveTemplate]
  );

  // Cancelar edição
  const handleCancel = useCallback(() => {
    setEditingId(null);
  }, []);

  // Atualizar valor de edição
  const updateEditValue = useCallback(
    (templateId: string, field: 'template' | 'enabled', value: string | boolean) => {
      setEditValues((prev) => ({
        ...prev,
        [templateId]: {
          ...prev[templateId],
          [field]: value,
        },
      }));
    },
    []
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <MessageCircle className="w-5 h-5" />
          Configurar Templates de Status
        </h3>
        <p className="text-sm text-muted-foreground">
          Personalize as mensagens enviadas para cada status do pedido. Use os placeholders {'{nome}'} e {'{pedido}'}
        </p>
      </div>

      {/* Accordion com Templates */}
      <Accordion type="multiple" defaultValue={['pending', 'confirmed']} className="space-y-3">
        {templates.map((template) => {
          const config = STATUS_CONFIG[template.status] || { icon: '📝', label: template.status, color: 'bg-gray-50' };
          const isEditing = editingId === template.id;
          const values = editValues[template.id] || {
            template: template.message_template,
            enabled: template.enabled,
          };

          return (
            <Card key={template.id} className={config.color}>
              <AccordionItem value={template.status} className="border-0">
                <div className="flex items-center justify-between px-4 pt-4">
                  <AccordionTrigger className="flex-1 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <p className="font-semibold">
                          {config.label}
                          {!template.enabled && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(Desativado)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                          {template.message_template}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  {/* Toggle Enabled */}
                  <div className="flex items-center gap-3 ml-2">
                    <Switch
                      checked={values.enabled}
                      onCheckedChange={(checked) =>
                        updateEditValue(template.id, 'enabled', checked)
                      }
                      disabled={!isEditing && saving}
                    />
                  </div>
                </div>

                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    {/* Campo de Texto */}
                    <div className="space-y-2">
                      <Label htmlFor={`template-${template.id}`}>Mensagem do Template</Label>
                      {isEditing ? (
                        <Textarea
                          id={`template-${template.id}`}
                          value={values.template}
                          onChange={(e) =>
                            updateEditValue(template.id, 'template', e.target.value)
                          }
                          placeholder="Digite sua mensagem..."
                          className="min-h-[100px] resize-none"
                          disabled={saving}
                        />
                      ) : (
                        <div className="p-3 bg-white rounded-md border border-input text-sm whitespace-pre-wrap break-words">
                          {template.message_template}
                        </div>
                      )}
                    </div>

                    {/* Placeholders Disponíveis */}
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-xs font-semibold text-blue-900 mb-2">Placeholders disponíveis:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PLACEHOLDERS.map((placeholder) => (
                          <div key={placeholder.name} className="text-xs">
                            <code className="bg-blue-100 px-2 py-1 rounded font-mono text-blue-900">
                              {placeholder.name}
                            </code>
                            <p className="text-blue-700 mt-1">{placeholder.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 pt-4">
                      {!isEditing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            initializeEdit(template);
                            setEditingId(template.id);
                          }}
                          className="flex-1"
                        >
                          Editar
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleSave(template.id)}
                            disabled={saving}
                            className="flex-1 gap-2"
                          >
                            {saving ? (
                              <>
                                <Loader className="w-3 h-3 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <Save className="w-3 h-3" />
                                Salvar
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Info de Última Atualização */}
                    <p className="text-xs text-muted-foreground">
                      Última atualização: {new Date(template.updated_at).toLocaleDateString('pt-BR')}{' '}
                      às {new Date(template.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Card>
          );
        })}
      </Accordion>
    </div>
  );
};
