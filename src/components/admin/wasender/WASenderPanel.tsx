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
  type: 'audio' | 'image' | 'document';
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

      // 3. Add messages with attachments
      for (const msg of messages) {
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
            // Upload file to Supabase Storage
            const fileName = `campaigns/${campaignId}/msg${msg.sequence}/${att.name}`;
            const { error: uploadError } = await (supabase as any).storage
              .from('marketing-attachments')
              .upload(fileName, att.file, { upsert: true });

            if (!uploadError) {
              const { data: urlData } = (supabase as any).storage
                .from('marketing-attachments')
                .getPublicUrl(fileName);

              // Insert media record
              await (supabase as any)
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
            }
          }
        }
      }

      // 4. Create delay config
      await (supabase as any)
        .from('campaign_delay_config')
        .insert({
          campaign_id: campaignId,
          tenant_id: tenantId,
          delay_before_each_msg_seconds: delayConfig.delayBeforeEachMsg,
          delay_after_x_messages: delayConfig.delayAfterXMessages,
          delay_after_x_messages_seconds: delayConfig.delayAfterXMessageSeconds,
        });

      // 5. Create analytics record
      await (supabase as any)
        .from('campaign_analytics_v2')
        .insert({
          campaign_id: campaignId,
          tenant_id: tenantId,
          total_contacts: contacts.length,
        });

      toast.success(
        `✅ Campanha "${launchConfig.name}" ${immediate ? 'iniciada' : 'agendada'}!`
      );

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
          onDelete={() => {
            loadCampaigns();
            setSelectedCampaign(null);
          }}
          onEdit={() => {
            // Implementar edição later
            toast.info('Edição será implementada em breve');
          }}
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
                💬 Mensagens (5)
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
