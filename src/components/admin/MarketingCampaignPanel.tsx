import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureTenantId } from '@/hooks/use-secure-tenant-id';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Megaphone, Plus, Send, BarChart3, Trash2, Edit2, Play, Pause, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  description: string;
  template_text: string;
  segment_filters: Record<string, any>;
  total_contacts: number;
  scheduled_at: string;
  messages_per_minute: number;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  sent_count: number;
  failed_count: number;
  unsubscribed_count: number;
  created_at: string;
}

interface CampaignAnalytics {
  campaign_id: string;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  total_unsubscribed: number;
  total_link_clicks: number;
  delivery_rate: number;
  read_rate: number;
  click_rate: number;
  orders_generated: number;
  revenue_generated: number;
  conversion_rate: number;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}));

const DEFAULT_TEMPLATES = {
  promotional: `🎉 Ótima notícia, {nome}!

Nós temos uma oferta especial só para você:

🍕 {desconto}% DE DESCONTO na sua próxima compra!
Cupom: PROMO{codigo}

Válido até {data_validade}

Aproveita! Clique abaixo para fazer seu pedido:
{link}

Obrigado pela preferência! 🙏`,
  
  reminder: `Oi {nome}! 👋

Já faz {dias_ultimo_pedido} dias que não nos vê...

Sentiremos sua falta! 😢

Que tal reviver aquele momento delicioso?

🍕 Faça seu pedido agora:
{link}

Cupom especial para você: 5% OFF
Código: SAUDADE5

Esperamos por você!`,

  announcement: `📢 {nome}, vem notícia boa!

{titulo}

{descricao}

{link}

Quer saber mais? Clique acima!`,
};

export function MarketingCampaignPanel() {
  const { tenantId } = useSecureTenantId();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, CampaignAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: DEFAULT_TEMPLATES.promotional,
    templateType: 'promotional',
    lastOrderDays: 180,
    minSpent: 0,
    frequencyLevel: 'all', // all, frequent (5+), casual (2-4), rare (1)
    neighborhoods: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledHour: 20, // 20h = best time
    messagesPerMinute: 100,
  });

  useEffect(() => {
    if (!tenantId) return;
    loadCampaigns();
  }, [tenantId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);

      const { data: campaignsData, error: campaignsError } = await (supabase as any)
        .from('marketing_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      setCampaigns(campaignsData || []);

      // Load analytics for each campaign
      if (campaignsData && campaignsData.length > 0) {
        const { data: analyticsData } = await (supabase as any)
          .from('campaign_analytics')
          .select('*')
          .in('campaign_id', campaignsData.map((c: any) => c.id));

        const analyticsMap: Record<string, CampaignAnalytics> = {};
        analyticsData?.forEach((a: any) => {
          analyticsMap[a.campaign_id] = a;
        });
        setAnalytics(analyticsMap);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da campanha é obrigatório');
      return;
    }
    if (!formData.template.trim()) {
      toast.error('Template da mensagem é obrigatório');
      return;
    }

    try {
      // 1️⃣ Create campaign
      const { data: newCampaign, error: createError } = await (supabase as any)
        .from('marketing_campaigns')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          description: formData.description,
          template_text: formData.template,
          segment_filters: {
            last_order_days: formData.lastOrderDays,
            min_spent: formData.minSpent,
            frequency_level: formData.frequencyLevel,
            neighborhoods: formData.neighborhoods,
          },
          scheduled_at: `${formData.scheduledDate}T${String(formData.scheduledHour).padStart(2, '0')}:00:00`,
          messages_per_minute: formData.messagesPerMinute,
          status: 'scheduled',
        })
        .select()
        .single();

      if (createError) throw createError;

      const campaignId = newCampaign.id;
      console.log(`✅ Campaign created: ${campaignId}`);

      // 2️⃣ Apply segmentation to populate contacts
      const { error: segError } = await (supabase as any)
        .rpc('apply_campaign_segmentation', {
          p_campaign_id: campaignId,
          p_tenant_id: tenantId,
        });

      if (segError) {
        console.error('⚠️ Segmentation error:', segError);
        toast.warning('Campanha criada, mas erro ao aplicar filtros');
      } else {
        console.log(`✅ Segmentation applied`);
      }

      // 3️⃣ Create campaign_messages for each contact
      const { data: contacts, error: contactError } = await (supabase as any)
        .from('campaign_contacts')
        .select('customer_phone, customer_name')
        .eq('campaign_id', campaignId);

      if (!contactError && contacts && contacts.length > 0) {
        const messages = contacts.map((c: any) => ({
          campaign_id: campaignId,
          tenant_id: tenantId,
          customer_phone: c.customer_phone,
          message_text: formData.template.replace('{nome}', c.customer_name || 'Cliente'),
          status: 'pending',
        }));

        const { error: msgError } = await (supabase as any)
          .from('campaign_messages')
          .insert(messages);

        if (msgError) {
          console.error('⚠️ Error creating messages:', msgError);
        } else {
          console.log(`✅ ${messages.length} messages created`);
        }
      }

      // 4️⃣ Create analytics record
      await (supabase as any)
        .from('campaign_analytics')
        .insert({
          campaign_id: campaignId,
          tenant_id: tenantId,
        });

      toast.success(`✅ Campanha "${formData.name}" criada com ${contacts?.length || 0} contatos!`);
      setShowNewDialog(false);
      setFormData({
        name: '',
        description: '',
        template: DEFAULT_TEMPLATES.promotional,
        templateType: 'promotional',
        lastOrderDays: 180,
        minSpent: 0,
        frequencyLevel: 'all',
        neighborhoods: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledHour: 20,
        messagesPerMinute: 100,
      });
      loadCampaigns();
    } catch (err: any) {
      console.error('Erro ao criar campanha:', err);
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .update({ status: 'running' })
        .eq('id', campaignId);

      if (error) throw error;

      toast.success('✅ Campanha iniciada!');
      loadCampaigns();
    } catch (err) {
      console.error('Erro ao iniciar campanha:', err);
      toast.error('Erro ao iniciar campanha');
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId);

      if (error) throw error;

      toast.success('✅ Campanha pausada');
      loadCampaigns();
    } catch (err) {
      console.error('Erro ao pausar campanha:', err);
      toast.error('Erro ao pausar campanha');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Tem certeza? Todos os dados da campanha serão deletados.')) return;

    try {
      // Delete in cascade order
      await (supabase as any).from('campaign_messages').delete().eq('campaign_id', campaignId);
      await (supabase as any).from('campaign_contacts').delete().eq('campaign_id', campaignId);
      await (supabase as any).from('campaign_analytics').delete().eq('campaign_id', campaignId);
      await (supabase as any).from('marketing_campaigns').delete().eq('id', campaignId);

      toast.success('✅ Campanha deletada');
      loadCampaigns();
    } catch (err) {
      console.error('Erro ao deletar campanha:', err);
      toast.error('Erro ao deletar campanha');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      scheduled: 'outline',
      running: 'default',
      paused: 'destructive',
      completed: 'outline',
    };

    const labels: Record<string, string> = {
      draft: '📝 Rascunho',
      scheduled: '⏰ Agendado',
      running: '🚀 Em execução',
      paused: '⏸️ Pausado',
      completed: '✅ Completo',
    };

    return <Badge variant={variants[status] as any}>{labels[status]}</Badge>;
  };

  if (loading) {
    return <div className="p-6">Carregando campanhas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8" />
            Marketing & Campanhas
          </h2>
          <p className="text-muted-foreground mt-1">
            Crie campanhas inteligentes com segmentação, agendamento e analytics
          </p>
        </div>

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                Configure segmentação, template e agendamento
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">📝 Básico</TabsTrigger>
                <TabsTrigger value="segment">🎯 Segmentação</TabsTrigger>
                <TabsTrigger value="schedule">⏰ Agendamento</TabsTrigger>
              </TabsList>

              {/* TAB 1: BASIC */}
              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label>Nome da Campanha</Label>
                  <Input
                    placeholder="ex: Black Friday 2026"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    placeholder="Descrição interna da campanha"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Template</Label>
                  <Select
                    value={formData.templateType}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        templateType: value,
                        template: DEFAULT_TEMPLATES[value as keyof typeof DEFAULT_TEMPLATES],
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promotional">🎉 Promocional</SelectItem>
                      <SelectItem value="reminder">📢 Lembrete</SelectItem>
                      <SelectItem value="announcement">📣 Anúncio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mensagem (com personalização)</Label>
                  <Textarea
                    value={formData.template}
                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    rows={8}
                    className="font-mono text-sm mt-1"
                    placeholder="Use placeholders: {nome}, {desconto}, {link}, {data_validade}, etc"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Placeholders: {'{nome}'}, {'{desconto}'}, {'{link}'}, {'{data_validade}'}, {'{dias_ultimo_pedido}'}
                  </p>
                </div>
              </TabsContent>

              {/* TAB 2: SEGMENTATION */}
              <TabsContent value="segment" className="space-y-4">
                <div>
                  <Label>Último Pedido há (dias)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={formData.lastOrderDays}
                    onChange={(e) => setFormData({ ...formData, lastOrderDays: Number(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Inclui clientes que pediram nos últimos {formData.lastOrderDays} dias
                  </p>
                </div>

                <div>
                  <Label>Gasto Mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={formData.minSpent}
                    onChange={(e) => setFormData({ ...formData, minSpent: Number(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas clientes que gastaram R$ {formData.minSpent}+
                  </p>
                </div>

                <div>
                  <Label>Frequência de Compra</Label>
                  <Select
                    value={formData.frequencyLevel}
                    onValueChange={(value) => setFormData({ ...formData, frequencyLevel: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">👥 Todos os clientes</SelectItem>
                      <SelectItem value="frequent">🔥 Frequentes (5+ pedidos)</SelectItem>
                      <SelectItem value="casual">⭐ Ocasionais (2-4 pedidos)</SelectItem>
                      <SelectItem value="rare">🆕 Muito raros (1 pedido)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bairros (separados por vírgula)</Label>
                  <Textarea
                    placeholder="ex: Centro, Zona Sul, Vila Norte"
                    value={formData.neighborhoods}
                    onChange={(e) => setFormData({ ...formData, neighborhoods: e.target.value })}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </TabsContent>

              {/* TAB 3: SCHEDULE */}
              <TabsContent value="schedule" className="space-y-4">
                <div>
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Horário Ótimo (melhor conversão)</Label>
                  <Select
                    value={String(formData.scheduledHour)}
                    onValueChange={(value) => setFormData({ ...formData, scheduledHour: Number(value) })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Melhor horário: 20h-21h (maior engajamento)
                  </p>
                </div>

                <div>
                  <Label>Velocidade (mensagens/minuto)</Label>
                  <Select
                    value={String(formData.messagesPerMinute)}
                    onValueChange={(value) => setFormData({ ...formData, messagesPerMinute: Number(value) })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">🐌 50 (devagar, mais seguro)</SelectItem>
                      <SelectItem value="100">🚗 100 (recomendado)</SelectItem>
                      <SelectItem value="150">🚀 150 (rápido)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Não ultrapasse 150 para evitar bloqueio da Evolution API
                  </p>
                </div>

                <Button onClick={handleCreateCampaign} className="w-full mt-6">
                  <Send className="w-4 h-4 mr-2" />
                  Criar Campanha
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* CAMPAIGNS TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Gerencie suas campanhas de marketing</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma campanha criada. Crie uma para começar!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Enviadas</TableHead>
                  <TableHead>Taxa Entrega</TableHead>
                  <TableHead>Agendado</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const metrics = analytics[campaign.id];
                  const deliveryRate = metrics?.delivery_rate || 0;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>{campaign.total_contacts}</TableCell>
                      <TableCell>{campaign.sent_count}</TableCell>
                      <TableCell>{deliveryRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-sm">
                        {new Date(campaign.scheduled_at).toLocaleDateString('pt-BR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {campaign.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartCampaign(campaign.id)}
                            title="Iniciar"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {campaign.status === 'running' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePauseCampaign(campaign.id)}
                            title="Pausar"
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            // TODO: Show analytics modal
                            toast.info('Analytics em desenvolvimento');
                          }}
                          title="Analytics"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GUIDELINES */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">📋 Boas Práticas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>✅ Use segmentação inteligente (últimos 180 dias + gasto mínimo R$ 50+)</p>
          <p>✅ Melhor horário para enviar: 20h-21h (até 60% mais clicks)</p>
          <p>✅ Respeite opt-outs (clientes que digitam "sair")</p>
          <p>✅ Taxa de entrega normal: 85-95% (alguns números inválidos)</p>
          <p>⚠️ Não ultrapasse 150 msgs/min para não bloquear Evolution API</p>
        </CardContent>
      </Card>
    </div>
  );
}
