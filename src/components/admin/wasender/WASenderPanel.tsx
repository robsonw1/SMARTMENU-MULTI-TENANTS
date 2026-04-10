import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureTenantId } from '@/hooks/use-secure-tenant-id';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Send, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

import { ContactListTab } from './ContactListTab';
import { MessageConfigTab } from './MessageConfigTab';
import { DelayConfigTab } from './DelayConfigTab';
import { LaunchTab } from './LaunchTab';
import { ScheduleCampaignModal } from './ScheduleCampaignModal';
import { CampaignExecutionDashboard } from './CampaignExecutionDashboard';

interface Contact {
  phone: string;
  name: string;
  source: 'manual' | 'csv' | 'excel';
}

interface MessageAttachment {
  name: string;
  type: 'audio' | 'image' | 'video' | 'document';
  file: File;
  icon: string;
}

interface Message {
  sequence: number;
  text: string;
  attachments: MessageAttachment[];
}

interface DelayConfig {
  delayBeforeEachMsg: number;
  delayAfterXMessages: number;
  delayAfterXMessageSeconds: number;
}

interface LaunchConfig {
  name: string;
  description: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  started_at?: string;
  scheduled_at?: string;
}

export function WASenderPanel() {
  const { tenantId } = useSecureTenantId();

  // Forma para criar nova campanha
  const [showNewForm, setShowNewForm] = useState(false);
  const [currentTab, setCurrentTab] = useState('contacts');

  // State da nova campanha
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>(
    Array.from({ length: 5 }, (_, i) => ({
      sequence: i + 1,
      text: '',
      attachments: [],
    }))
  );
  const [delayConfig, setDelayConfig] = useState<DelayConfig>({
    delayBeforeEachMsg: 2,
    delayAfterXMessages: 2,
    delayAfterXMessageSeconds: 10,
  });
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig>({
    name: '',
    description: '',
  });

  // Estado de campanhas criadas
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal de agendamento
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    loadCampaigns();
  }, [tenantId]);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('wasender_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    }
  };

  // Helper: Sanitize filename to avoid storage errors
  const sanitizeFileName = (fileName: string): string => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
  };

  const handleDeleteCampaign = async (campaignId: string): Promise<boolean> => {
    if (!window.confirm('Tem certeza que deseja remover esta campanha? Todos os dados serão deletados permanentemente.')) {
      return false;
    }

    try {
      setLoading(true);

      // Delete in cascade order (respect foreign keys)
      
      // 1. Delete campaign_execution_log
      const { error: execLogsError } = await (supabase as any)
        .from('campaign_execution_log')
        .delete()
        .eq('campaign_id', campaignId);
      if (execLogsError) throw execLogsError;

      // 2. Delete campaign_media_attachments
      const { error: mediaError } = await (supabase as any)
        .from('campaign_media_attachments')
        .delete()
        .eq('campaign_id', campaignId);
      if (mediaError) throw mediaError;

      // 3. Delete campaign_messages_v2
      const { error: messagesError } = await (supabase as any)
        .from('campaign_messages_v2')
        .delete()
        .eq('campaign_id', campaignId);
      if (messagesError) throw messagesError;

      // 4. Delete campaign_contact_lists
      const { error: contactsError } = await (supabase as any)
        .from('campaign_contact_lists')
        .delete()
        .eq('campaign_id', campaignId);
      if (contactsError) throw contactsError;

      // 5. Delete campaign_delay_config
      const { error: delayError } = await (supabase as any)
        .from('campaign_delay_config')
        .delete()
        .eq('campaign_id', campaignId);
      if (delayError) throw delayError;

      // 6. Delete campaign_analytics_v2
      const { error: analyticsError } = await (supabase as any)
        .from('campaign_analytics_v2')
        .delete()
        .eq('campaign_id', campaignId);
      if (analyticsError) throw analyticsError;

      // 7. Delete from storage (all files for this campaign)
      try {
        const { data: files, error: listError } = await (supabase as any).storage
          .from('marketing-attachments')
          .list(`campaigns/${campaignId}`);

        if (!listError && files) {
          for (const file of files) {
            await (supabase as any).storage
              .from('marketing-attachments')
              .remove([`campaigns/${campaignId}/${file.name}`]);
          }
        }
      } catch (storageErr) {
        console.warn('Storage cleanup warning:', storageErr);
        // Don't throw - continue anyway
      }

      // 8. Finally delete the campaign itself
      const { error: campaignError } = await (supabase as any)
        .from('wasender_campaigns')
        .delete()
        .eq('id', campaignId);
      if (campaignError) throw campaignError;

      toast.success('✅ Campanha removida completamente');
      return true;
    } catch (err: any) {
      console.error('Erro ao deletar campanha:', err);
      toast.error(`Erro ao deletar: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEditCampaign = async (campaignToEdit: Campaign) => {
    try {
      setLoading(true);

      // Load campaign data for editing
      const [contactsData, messagesData, delayData] = await Promise.all([
        (supabase as any)
          .from('campaign_contact_lists')
          .select('customer_phone, customer_name, source')
          .eq('campaign_id', campaignToEdit.id),
        (supabase as any)
          .from('campaign_messages_v2')
          .select('*')
          .eq('campaign_id', campaignToEdit.id)
          .order('sequence_number'),
        (supabase as any)
          .from('campaign_delay_config')
          .select('*')
          .eq('campaign_id', campaignToEdit.id)
          .single(),
      ]);

      if (contactsData.error || messagesData.error) {
        throw new Error('Erro ao carregar dados da campanha');
      }

      // Populate form with existing data
      setContacts(
        (contactsData.data || []).map((c: any) => ({
          phone: c.customer_phone,
          name: c.customer_name,
          source: c.source as 'manual' | 'csv' | 'excel',
        }))
      );

      // Build messages with attachments
      if (messagesData.data) {
        const messagesWithAttachments = await Promise.all(
          messagesData.data.map(async (msg: any) => {
            const { data: attachments } = await (supabase as any)
              .from('campaign_media_attachments')
              .select('*')
              .eq('message_id', msg.id);

            return {
              sequence: msg.sequence_number,
              text: msg.message_text,
              attachments: (attachments || []).map((att: any) => ({
                name: att.file_name,
                type: att.media_type as 'audio' | 'image' | 'document',
                file: null, // Can't reconstruct File object
                icon: att.media_type === 'audio' ? '🎵' : att.media_type === 'image' ? '🖼️' : '📄',
              })),
            };
          })
        );

        setMessages(
          Array.from({ length: 5 }, (_, i) => {
            const existing = messagesWithAttachments.find((m) => m.sequence === i + 1);
            return existing || { sequence: i + 1, text: '', attachments: [] };
          })
        );
      }

      if (delayData.data) {
        setDelayConfig({
          delayBeforeEachMsg: delayData.data.delay_before_each_msg_seconds,
          delayAfterXMessages: delayData.data.delay_after_x_messages,
          delayAfterXMessageSeconds: delayData.data.delay_after_x_messages_seconds,
        });
      }

      setLaunchConfig({
        name: campaignToEdit.name,
        description: campaignToEdit.name,
      });

      setShowNewForm(true);
      setCurrentTab('contacts');
      setSelectedCampaign(null);
      toast.info('Edite os dados da campanha e clique em "INICIAR AGORA" para atualizar');
    } catch (err: any) {
      console.error('Erro ao carregar campanha para edição:', err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaignCallback = async () => {
    if (selectedCampaign) {
      const success = await handleDeleteCampaign(selectedCampaign.id);
      if (success) {
        loadCampaigns();
        setSelectedCampaign(null);
      }
    }
  };

  const handleCreateCampaign = async (immediate: boolean = true) => {
    if (!launchConfig.name.trim()) {
      toast.error('Digite o nome da campanha');
      return;
    }

    if (contacts.length === 0) {
      toast.error('Adicione contatos antes de criar');
      return;
    }

    try {
      setLoading(true);

      // 1. Create campaign
      const { data: campaign, error: campaignError } = await (supabase as any)
        .from('wasender_campaigns')
        .insert({
          tenant_id: tenantId,
          name: launchConfig.name,
          description: launchConfig.description,
          status: immediate ? 'running' : 'scheduled',
          scheduled_at: immediate ? null : new Date().toISOString(),
          started_at: immediate ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const campaignId = campaign.id;

      // 2. Add contacts
      const contactsToInsert = contacts.map((c) => ({
        campaign_id: campaignId,
        tenant_id: tenantId,
        customer_phone: c.phone,
        customer_name: c.name,
        source: c.source,
      }));

      const { error: contactsError } = await (supabase as any)
        .from('campaign_contact_lists')
        .insert(contactsToInsert);

      if (contactsError) throw contactsError;

      // 3. Add messages with attachments (ONLY non-empty messages)
      const messagesWithText = messages.filter((m) => m.text.trim() !== '');
      
      if (messagesWithText.length === 0) {
        throw new Error('Adicione pelo menos uma mensagem com texto');
      }

      for (const msg of messagesWithText) {
        const { data: msgData, error: msgError } = await (supabase as any)
          .from('campaign_messages_v2')
          .insert({
            campaign_id: campaignId,
            tenant_id: tenantId,
            sequence_number: msg.sequence,
            message_text: msg.text,
          })
          .select()
          .single();

        if (msgError) throw msgError;

        // Upload attachments if any
        if (msg.attachments.length > 0) {
          for (const att of msg.attachments) {
            // Validate file
            if (att.file.size === 0) {
              throw new Error(`Arquivo ${att.name} está vazio`);
            }

            // Validate file size by type
            const maxSizes: Record<string, number> = {
              image: 5 * 1024 * 1024,      // 5MB
              video: 50 * 1024 * 1024,     // 50MB
              audio: 16 * 1024 * 1024,     // 16MB
              document: 100 * 1024 * 1024, // 100MB
            };
            const maxSize = maxSizes[att.type] || 100 * 1024 * 1024;
            if (att.file.size > maxSize) {
              const maxMB = maxSize / (1024 * 1024);
              throw new Error(`Arquivo ${att.name} excede ${maxMB}MB`);
            }

            // Sanitize and upload file
            const sanitizedFileName = sanitizeFileName(att.name);
            const fileName = `campaigns/${campaignId}/msg${msg.sequence}/${Date.now()}_${sanitizedFileName}`;
            
            try {
              const { error: uploadError } = await (supabase as any).storage
                .from('marketing-attachments')
                .upload(fileName, att.file, { upsert: false });

              if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw new Error(`Erro ao fazer upload de ${att.name}: ${uploadError.message}`);
              }

              const { data: urlData } = (supabase as any).storage
                .from('marketing-attachments')
                .getPublicUrl(fileName);

              // Insert media record
              const { error: mediaError } = await (supabase as any)
                .from('campaign_media_attachments')
                .insert({
                  message_id: msgData.id,
                  campaign_id: campaignId,
                  tenant_id: tenantId,
                  file_name: att.name,
                  file_type: att.file.type,
                  file_size_bytes: att.file.size,
                  file_url: urlData.publicUrl,
                  media_type: att.type,
                });

              if (mediaError) throw mediaError;
            } catch (uploadErr: any) {
              console.error('File upload failed:', uploadErr);
              throw new Error(`Falha no upload: ${uploadErr.message}`);
            }
          }
        }
      }

      // 4. Create execution log (ONLY if immediate execution)
      if (immediate) {
        const executionRecords = [];
        for (const contact of contacts) {
          for (const msg of messagesWithText) {
            executionRecords.push({
              campaign_id: campaignId,
              tenant_id: tenantId,
              customer_phone: contact.phone,
              customer_name: contact.name || contact.phone,
              message_sequence: msg.sequence,
              status: 'pending',
              scheduled_at: new Date().toISOString(),
            });
          }
        }

        if (executionRecords.length > 0) {
          const { error: execError } = await (supabase as any)
            .from('campaign_execution_log')
            .insert(executionRecords);

          if (execError) {
            console.warn('Execution log creation warning:', execError);
            // Don't throw - continue anyway
          }
        }
      }

      // 5. Create delay config
      const { error: delayError } = await (supabase as any)
        .from('campaign_delay_config')
        .insert({
          campaign_id: campaignId,
          tenant_id: tenantId,
          delay_before_each_msg_seconds: delayConfig.delayBeforeEachMsg,
          delay_after_x_messages: delayConfig.delayAfterXMessages,
          delay_after_x_messages_seconds: delayConfig.delayAfterXMessageSeconds,
        });

      if (delayError) console.warn('Delay config warning:', delayError);

      // 6. Create analytics record
      const { error: analyticsError } = await (supabase as any)
        .from('campaign_analytics_v2')
        .insert({
          campaign_id: campaignId,
          tenant_id: tenantId,
          total_contacts: contacts.length,
        });

      if (analyticsError) console.warn('Analytics creation warning:', analyticsError);

      // 7. Trigger Edge Function for immediate execution
      if (immediate) {
        try {
          // Show initial toast
          const toastId = toast.loading(`🚀 Iniciando campanha "${launchConfig.name}"...`);
          
          const { error: funcError } = await supabase.functions.invoke(
            'process-wasender-campaigns',
            {
              body: {
                campaignId,
                tenantId,
              },
            }
          );

          // Update toast based on response
          if (funcError) {
            console.warn('Edge Function trigger warning:', funcError);
            toast.dismiss(toastId);
            toast.success(
              `✅ Campanha criada! Processamento iniciando em background...`
            );
          } else {
            toast.dismiss(toastId);
            toast.success(
              `✅ Campanha "${launchConfig.name}" iniciada com sucesso!\n📊 Acompanhe em tempo real abaixo...`
            );
          }
        } catch (funcErr: any) {
          console.warn('Edge Function call warning:', funcErr);
          toast.success(
            `✅ Campanha "${launchConfig.name}" criada!\n📊 Processamento em andamento...`
          );
        }
      } else {
        toast.success(
          `✅ Campanha "${launchConfig.name}" agendada com sucesso!`
        );
      }

      // Reset form
      setShowNewForm(false);
      setContacts([]);
      setMessages(Array.from({ length: 5 }, (_, i) => ({ sequence: i + 1, text: '', attachments: [] })));
      setLaunchConfig({ name: '', description: '' });
      setCurrentTab('contacts');

      loadCampaigns();
    } catch (err: any) {
      console.error('Erro:', err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (selectedCampaign) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={() => setSelectedCampaign(null)}
        >
          ← Voltar para campanhas
        </Button>
        <CampaignExecutionDashboard
          campaign={selectedCampaign}
          onStatusChange={(status) => {
            setSelectedCampaign({ ...selectedCampaign, status });
          }}
          onDelete={handleDeleteCampaignCallback}
          onEdit={() => handleEditCampaign(selectedCampaign)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8" />
            WASender Campanhas
          </h2>
          <p className="text-muted-foreground mt-1">
            Crie campanhas com 5 mensagens, anexos e agendamento
          </p>
        </div>

        {!showNewForm && (
          <Button onClick={() => setShowNewForm(true)} size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        )}
      </div>

      {/* New Campaign Form */}
      {showNewForm && (
        <Card className="p-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="contacts">
                👥 Contatos ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="messages">
                💬 Mensagens ({messages.filter((m) => m.text.trim() !== '').length})
              </TabsTrigger>
              <TabsTrigger value="delays">⏱️ Atrasos</TabsTrigger>
              <TabsTrigger value="launch">🚀 Lançar</TabsTrigger>
            </TabsList>

            <TabsContent value="contacts">
              <ContactListTab contacts={contacts} onContactsChange={setContacts} />
            </TabsContent>

            <TabsContent value="messages">
              <MessageConfigTab messages={messages} onMessagesChange={setMessages} />
            </TabsContent>

            <TabsContent value="delays">
              <DelayConfigTab config={delayConfig} onConfigChange={setDelayConfig} />
            </TabsContent>

            <TabsContent value="launch">
              <LaunchTab
                config={launchConfig}
                onConfigChange={setLaunchConfig}
                totalContacts={contacts.length}
                totalMessages={messages.filter((m) => m.text.trim() !== '').length}
                onSchedule={() => setShowScheduleModal(true)}
                onLaunchNow={() => handleCreateCampaign(true)}
                isLoading={loading}
              />
            </TabsContent>
          </Tabs>

          {/* Close form button */}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewForm(false);
                setContacts([]);
                setMessages(Array.from({ length: 5 }, (_, i) => ({ sequence: i + 1, text: '', attachments: [] })));
                setLaunchConfig({ name: '', description: '' });
                setCurrentTab('contacts');
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Campaigns List */}
      {campaigns.length > 0 && !showNewForm && (
        <Card>
          <div className="p-6">
            <h3 className="font-semibold mb-4">Campanhas Criadas</h3>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {campaign.status}
                    </p>
                  </div>
                  <Send className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {campaigns.length === 0 && !showNewForm && (
        <Card>
          <div className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
            <Button onClick={() => setShowNewForm(true)} className="mt-4">
              Criar primeira campanha
            </Button>
          </div>
        </Card>
      )}

      {/* Schedule Modal */}
      <ScheduleCampaignModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        onConfirm={async (data) => {
          // Atualizar scheduled_at com data e hora
          const scheduledDateTime = new Date(`${data.scheduledDate}T${String(data.scheduledHour).padStart(2, '0')}:00:00`);
          // Depois chamar createCampaign com scheduled = false
          await handleCreateCampaign(false);
          setShowScheduleModal(false);
        }}
        isLoading={loading}
      />
    </div>
  );
}
