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
import { MessageCircle, Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Types
interface ChatbotConfig {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  response_timeout_seconds: number;
  escalation_keywords?: string[];
  fallback_message: string;
  pause_duration_minutes?: number;
  auto_pause_on_escalation?: boolean;
  created_at: string;
  updated_at: string;
}

interface ChatbotRule {
  id: string;
  chatbot_config_id: string;
  intent: string;
  keywords: string[];
  pattern_regex: string;
  response_template: string;
  response_variation_1: string;
  response_variation_2: string;
  match_threshold: number;
  enabled: boolean;
  order_priority: number;
  created_at: string;
  updated_at: string;
}

interface WhatsAppInstance {
  id: string;
  webhook_pending: boolean;
  webhook_configured_at: string | null;
  is_connected: boolean;
}

const INTENT_LABELS: Record<string, string> = {
  hours: '🕐 Horário de Atendimento',
  menu: '📋 Cardápio Completo',
  order_how: '📦 Como Fazer Pedido',
  order_status: '🚗 Status do Pedido',
  customization: '🍕 Customização',
  payment: '💳 Formas de Pagamento',
  delivery: '🚚 Entrega',
  minimum_order: '💰 Valor Mínimo',
  location: '📍 Localização',
  contact: '📞 Contato',
  custom: '⚙️ Customizado',
};

const KEYWORD_EXAMPLES: Record<string, string> = {
  hours: 'horário, abre quando, que horas, quando abre',
  menu: 'cardápio, menu, catálogo, o que vocês têm, prato do dia',
  order_how: 'como pedir, como faço, como encomendar, passo a passo',
  order_status: 'ta acaminho, já saiu, meu pedido, onde está, quando chega, status pedido',
  customization: 'personalizar, aceita vale refeição, sem..., com..., mudança',
  payment: 'pagar, pagamento, cartão, aceita pix',
  delivery: 'entrega, delivery, frete, taxa envio',
  minimum_order: 'valor mínimo, mínimo pedido, qual mínimo',
  location: 'endereço, onde fica, localização, avenida',
  contact: 'contato, telefone, whatsapp, fone',
  custom: 'sua palavra-chave aqui',
};

const INTENT_TEMPLATES: Record<string, string> = {
  hours:
    'Olá! 👋 Nosso horário de atendimento é:\n🕐 Segunda a Sexta: {store.hours_weekday}\n🕐 Sábado: {store.hours_saturday}\n🕐 Domingo: {store.hours_sunday}',
  menu: 'Veja nosso cardápio completo de hoje:\n{store.url}\n\n📱 Peça online em nosso APP e Ganhe 2% de Cashback a cada compra!\n\nObrigado pela preferência🙏',
  order_how: '📱 Basta acessar nosso APP:\n{store.url}\n\n1️⃣ Escolher seus produtos\n2️⃣ Adicionar ao carrinho\n3️⃣ Escolher forma de pagamento (PIX, Crédito, Débito ou Dinheiro)\n4️⃣ Pronto! Seu pedido chegará em ~{store.delivery_time} minutos',
  order_status: 'Motoboy já está na rua com seu pedido\n⏱️ deve chegar em 15 min',
  payment: 'Aceitamos:\n💳 Cartão de Crédito/Débito\n🟢 PIX (Instantânico)\n💰 Dinheiro na entrega',
  delivery: 'Sim! Fazemos entrega dentro do bairro.\n\n 📱 Peça online em nosso APP:\n{store.url}\n\n🚚 Tempo médio: {store.delivery_time} minutos',
  location: 'Aqui está nossa localização:\n📍 [Adicione o link da sua localização]\n\n📱 Peça pelo nosso APP crie sua conta e ganhe 2% de Cashback a cada compra!\n{store.url}',
  customization: 'Sim, fazemos customizações! 🍕\n\nVocê pode escolher:\n✨ Remover ingredientes\n✨ Adicionar extras\n✨ Substituir ingredientes\n\n📱 Faça seu pedido personalizado em:\n{store.url}',
  minimum_order: 'Valor mínimo para entrega: R$ [Seu valor mínimo]\n\n💡 Dica: Você pode aproveitar e pedir um Sachê ou uma Bebida para completar e ganhar 2% de Cashback!\n\n📱 Peça agora:\n{store.url}',
  contact: 'Entre em contato conosco! 📞\n\n📞 Telefone: {store.phone}\n📍 Endereço: {store.address}\n🕐 Horários: {store.hours_weekday}\n\n📱 Também estamos no APP:\n{store.url}',
  custom: 'Digite aqui sua resposta personalizada para esta pergunta!',
};

export function ChatbotSettingsPanel() {
  const { tenantId } = useSecureTenantId();
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [rules, setRules] = useState<ChatbotRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<WhatsAppInstance | null>(null);

  // Form state - Editable fields
  const [editMode, setEditMode] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [escalationKeywords, setEscalationKeywords] = useState('atendente');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [pauseDurationMinutes, setPauseDurationMinutes] = useState(30);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // Form state
  const [editingRule, setEditingRule] = useState<ChatbotRule | null>(null);
  const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);
  const [newRuleIntent, setNewRuleIntent] = useState('hours');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [newRuleResponse, setNewRuleResponse] = useState(INTENT_TEMPLATES['hours']);

  // Load data
  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId]);

  // Update response template quando intent muda
  useEffect(() => {
    if (INTENT_TEMPLATES[newRuleIntent]) {
      setNewRuleResponse(INTENT_TEMPLATES[newRuleIntent]);
    }
  }, [newRuleIntent]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load config
      const { data: configData, error: configError } = await (supabase as any)
        .from('chatbot_configurations')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (configError) {
        console.error('❌ Erro ao buscar config:', configError);
        throw configError;
      }

      let finalConfig = configData?.[0] as ChatbotConfig | null;

      // ✅ FALLBACK: Se não houver config, criar uma via RPC (contorna RLS)
      if (!finalConfig) {
        console.warn('⚠️ Nenhuma config encontrada. Criando via RPC function...');
        const { data: rpcResult, error: rpcError } = await (supabase as any)
          .rpc('create_chatbot_config', {
            p_tenant_id: tenantId,
          });

        if (rpcError) {
          console.error('❌ Erro ao criar config via RPC:', rpcError);
          throw new Error(`Não foi possível criar configuração do chatbot: ${rpcError.message}`);
        }

        if (rpcResult && rpcResult.length > 0) {
          finalConfig = rpcResult[0] as ChatbotConfig;
          console.log('✅ Config criada com sucesso via RPC!', { id: finalConfig.id, tenant_id: finalConfig.tenant_id });
        } else {
          throw new Error('RPC não retornou dados de configuração');
        }
      }

      if (finalConfig) {
        setConfig(finalConfig);
        // ✅ Populate editable fields
        setTimeoutSeconds(finalConfig.response_timeout_seconds || 30);
        // Convert array to comma-separated string for editing
        const keywordsString = (finalConfig.escalation_keywords || ['atendente']).join(', ');
        setEscalationKeywords(keywordsString);
        setFallbackMessage(finalConfig.fallback_message || '');
        setPauseDurationMinutes(finalConfig.pause_duration_minutes || 30);
        setAutoPauseEnabled(finalConfig.auto_pause_on_escalation !== false);
      }

      // Load rules
      if (finalConfig) {
        const { data: rulesData, error: rulesError } = await (supabase as any)
          .from('chatbot_rules')
          .select('*')
          .eq('chatbot_config_id', finalConfig.id)
          .order('order_priority', { ascending: true });

        if (rulesError) {
          console.error('❌ Erro ao buscar regras:', rulesError);
          // Não lança erro, só registra - regras podem estar vazias
        } else if (rulesData) {
          setRules(rulesData as ChatbotRule[]);
          console.log(`✅ ${rulesData.length} regra(s) carregada(s)`);
        }
      }

      // Load webhook status (skip if columns don't exist yet)
      // Este será carregado após migrations serem aplicadas
      console.log('⚠️ Carregamento de webhook_status será habilitado após migrations');
    } catch (err: any) {
      console.error('❌ Erro ao carregar dados do chatbot:', err);
      
      // Mensagens específicas
      if (err?.code === 'PGRST116') {
        toast.error('❌ Nenhuma configuração encontrada');
      } else if (err?.message?.includes('RLS')) {
        toast.error('❌ Você não tem permissão para acessar esta configuração');
      } else if (err?.message?.includes('401') || err?.message?.includes('403')) {
        toast.error('❌ Autenticação inválida. Faça login novamente.');
      } else {
        toast.error(`❌ Erro: ${err?.message || 'Desconhecido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChatbot = async (enabled: boolean) => {
    if (!config) return;

    try {
      const { error } = await (supabase as any)
        .from('chatbot_configurations')
        .update({ is_enabled: enabled })
        .eq('id', config.id);

      if (error) throw error;

      setConfig({ ...config, is_enabled: enabled });

      if (enabled) {
        toast.success('✅ Chatbot ativado!');
        const establishmentMessage = `
✅ Chatbot ativado com sucesso!

📝 Próximos passos:
1. Configure suas regras de palavras-chave e respostas
2. Salve as configurações
3. ⏳ Em até 24h o chatbot estará ativo nas suas conversas

Nota: O admin da plataforma está configurando o webhook manualmente.`;

        toast.message(establishmentMessage, {
          duration: 8000,
          closeButton: true,
        });

        console.log('✅ Chatbot ativado com sucesso para tenant:', tenantId);
      } else {
        toast.success('⏸️ Chatbot desativado');
      }
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar configuração');
    }
  };

  // ✅ NEW: Save configuration changes
  const handleSaveConfig = async () => {
    if (!config) return;

    // Validation
    if (!escalationKeywords.trim()) {
      toast.error('❌ Palavras-chave não podem estar vazias');
      return;
    }
    if (!fallbackMessage.trim()) {
      toast.error('❌ Mensagem padrão não pode estar vazia');
      return;
    }
    if (timeoutSeconds < 1 || timeoutSeconds > 300) {
      toast.error('❌ Timeout deve estar entre 1 e 300 segundos');
      return;
    }
    if (pauseDurationMinutes < 1 || pauseDurationMinutes > 120) {
      toast.error('❌ Duração de pausa deve estar entre 1 e 120 minutos');
      return;
    }

    try {
      setSaveLoading(true);

      // Convert comma-separated string to array
      const keywordsArray = escalationKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keywordsArray.length === 0) {
        toast.error('❌ Pelo menos uma palavra-chave é necessária');
        return;
      }

      const { error } = await (supabase as any)
        .from('chatbot_configurations')
        .update({
          response_timeout_seconds: timeoutSeconds,
          escalation_keywords: keywordsArray,
          fallback_message: fallbackMessage.trim(),
          pause_duration_minutes: pauseDurationMinutes,
          auto_pause_on_escalation: autoPauseEnabled,
        })
        .eq('id', config.id);

      if (error) throw error;

      // Update local state
      setConfig({
        ...config,
        response_timeout_seconds: timeoutSeconds,
        escalation_keywords: keywordsArray,
        fallback_message: fallbackMessage.trim(),
        pause_duration_minutes: pauseDurationMinutes,
        auto_pause_on_escalation: autoPauseEnabled,
      });

      setEditMode(false);
      toast.success('✅ Configurações salvas com sucesso!');
      console.log('✅ Chatbot config atualizada:', {
        timeout: timeoutSeconds,
        keywords: keywordsArray,
        pauseDuration: pauseDurationMinutes,
        autoPause: autoPauseEnabled,
      });
    } catch (err: any) {
      console.error('❌ Erro ao salvar:', err);
      toast.error(`❌ Erro ao salvar: ${err.message || 'Desconhecido'}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!config) {
      toast.error('Erro: Configuração do chatbot não carregada. Tente recarregar a página.');
      return;
    }

    if (!newRuleKeywords.trim()) {
      toast.error('Adicione pelo menos uma palavra-chave');
      return;
    }

    if (!newRuleResponse.trim()) {
      toast.error('Escreva uma resposta automática');
      return;
    }

    try {
      const keywords = newRuleKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const { data, error } = await (supabase as any)
        .from('chatbot_rules')
        .insert({
          chatbot_config_id: config.id,
          intent: newRuleIntent,
          keywords,
          response_template: newRuleResponse,
          response_variation_1: '',
          response_variation_2: '',
          match_threshold: 70,
          enabled: true,
          order_priority: rules.length + 1,
        })
        .select();

      if (error) throw error;

      if (data) {
        setRules([...rules, data[0] as ChatbotRule]);
        setShowNewRuleDialog(false);
        // Reset form ao fechar dialog
        setNewRuleKeywords('');
        setNewRuleIntent('hours');
        setNewRuleResponse(INTENT_TEMPLATES['hours']);
        toast.success('✅ Regra criada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao criar regra:', err);
      const errorMsg = (err as any)?.message || 'Erro desconhecido';
      
      // Mensagens específicas de erro
      if (errorMsg.includes('RLS')) {
        toast.error('❌ Erro de permissão. Você está autenticado?');
      } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
        toast.error('❌ Autenticação expirou. Faça login novamente.');
      } else {
        toast.error(`❌ Erro ao criar regra: ${errorMsg}`);
      }
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta regra?')) return;

    try {
      const { error } = await (supabase as any)
        .from('chatbot_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success('✅ Regra deletada');
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao deletar regra');
    }
  };

  const handleToggleRule = async (rule: ChatbotRule) => {
    try {
      const { error } = await (supabase as any)
        .from('chatbot_rules')
        .update({ enabled: !rule.enabled })
        .eq('id', rule.id);

      if (error) throw error;

      setRules(
        rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
      toast.success(rule.enabled ? '✅ Regra desativada' : '✅ Regra ativada');
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleEditRule = (rule: ChatbotRule) => {
    setEditingRule(rule);
    setNewRuleIntent(rule.intent);
    setNewRuleKeywords(rule.keywords.join(', '));
    setNewRuleResponse(rule.response_template);
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    if (!newRuleKeywords.trim()) {
      toast.error('Adicione pelo menos uma palavra-chave');
      return;
    }

    if (!newRuleResponse.trim()) {
      toast.error('Escreva uma resposta automática');
      return;
    }

    try {
      const keywords = newRuleKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const { error } = await (supabase as any)
        .from('chatbot_rules')
        .update({
          intent: newRuleIntent,
          keywords,
          response_template: newRuleResponse,
        })
        .eq('id', editingRule.id);

      if (error) throw error;

      setRules(
        rules.map((r) =>
          r.id === editingRule.id
            ? {
                ...r,
                intent: newRuleIntent,
                keywords,
                response_template: newRuleResponse,
              }
            : r
        )
      );

      setEditingRule(null);
      setNewRuleKeywords('');
      setNewRuleIntent('hours');
      setNewRuleResponse(INTENT_TEMPLATES['hours']);
      toast.success('✅ Regra atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar regra:', err);
      const errorMsg = (err as any)?.message || 'Erro desconhecido';

      if (errorMsg.includes('RLS')) {
        toast.error('❌ Erro de permissão. Você está autenticado?');
      } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
        toast.error('❌ Autenticação expirou. Faça login novamente.');
      } else {
        toast.error(`❌ Erro ao atualizar regra: ${errorMsg}`);
      }
    }
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="w-8 h-8" />
            Chatbot Inteligente
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure respostas automáticas para perguntas frequentes
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">⚙️ Configurações</TabsTrigger>
          <TabsTrigger value="rules">📋 Regras ({rules.length})</TabsTrigger>
        </TabsList>

        {/* CONFIGURATION TAB */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status do Chatbot</CardTitle>
              <CardDescription>Ative ou desative o chatbot para sua loja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div>
                      <h3 className="font-semibold">Habilitar Chatbot</h3>
                      <p className="text-sm text-muted-foreground">
                        {config.is_enabled ? '✅ Chatbot está ativo' : '⏸️ Chatbot desativado'}
                      </p>
                    </div>
                    <Switch checked={config.is_enabled} onCheckedChange={handleToggleChatbot} />
                  </div>

                  {/* ⚡ WEBHOOK STATUS WARNING */}
                  {config.is_enabled && (
                    webhookStatus?.webhook_pending ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="text-lg">🔄</div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-blue-900">Webhook em Configuração</h4>
                            <p className="text-sm text-blue-800 mt-1">
                              O admin da plataforma está configurando a conexão entre suas mensagens WhatsApp e o chatbot.
                            </p>
                            <p className="text-sm text-blue-700 mt-2 font-medium">
                              ⏳ Tempo estimado: até 24 horas
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : webhookStatus?.webhook_configured_at ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-green-900">Webhook Configurado ✅</h4>
                            <p className="text-sm text-green-800 mt-1">
                              A conexão com suas mensagens WhatsApp foi configurada com sucesso!
                            </p>
                            <p className="text-xs text-green-700 mt-2">
                              Configurado em: {new Date(webhookStatus.webhook_configured_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null
                  )}

                  {/* Settings */}
                  <div className="space-y-4">
                    {!editMode ? (
                      // VIEW MODE
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Timeout de Resposta</Label>
                          <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                            {config.response_timeout_seconds} segundos
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Palavras-chave para Escalar (atendente)</Label>
                          <div className="mt-2 p-3 bg-muted rounded-lg text-sm font-mono">
                            {(config.escalation_keywords || ['atendente']).map((keyword, idx) => (
                              <div key={idx}>
                                <Badge variant="secondary" className="mr-1 mb-1">
                                  "{keyword}"
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Mensagem Padrão</Label>
                          <div className="mt-2 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                            {config.fallback_message}
                          </div>
                        </div>

                        <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="text-lg">⏸️</div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-blue-900">Pausa Automática para Atendimento</h4>
                              <p className="text-sm text-blue-800 mt-1">
                                {config.auto_pause_on_escalation !== false
                                  ? '✅ Ativada: Quando cliente digita a palavra-chave, o chatbot pausa automaticamente por'
                                  : '⏸️ Desativada: O chatbot não pausa automaticamente'}
                              </p>
                              {config.auto_pause_on_escalation !== false && (
                                <p className="text-sm font-medium text-blue-900 mt-2">
                                  ⏱️ Duração: {config.pause_duration_minutes || 30} minutos
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => setEditMode(true)}
                            variant="outline"
                            className="flex-1"
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Editar Configurações
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // EDIT MODE
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="timeout" className="text-sm font-medium">
                            Timeout de Resposta (segundos)
                          </Label>
                          <Input
                            id="timeout"
                            type="number"
                            min="1"
                            max="300"
                            value={timeoutSeconds}
                            onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                            className="mt-1"
                            placeholder="30"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Tempo máximo para resposta automática</p>
                        </div>

                        <div>
                          <Label htmlFor="keywords" className="text-sm font-medium">
                            Palavras-chave para Escalar (múltiplas separadas por vírgula)
                          </Label>
                          <Input
                            id="keywords"
                            value={escalationKeywords}
                            onChange={(e) => setEscalationKeywords(e.target.value)}
                            className="mt-1"
                            placeholder="atendente, humano, falar com pessoa, suporte"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Cliente digita isso para falar com um atendente. Separe múltiplas palavras-chave com vírgula.
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="fallback" className="text-sm font-medium">
                            Mensagem Padrão (quando bot não entende)
                          </Label>
                          <Textarea
                            id="fallback"
                            value={fallbackMessage}
                            onChange={(e) => setFallbackMessage(e.target.value)}
                            className="mt-1"
                            rows={3}
                            placeholder="Desculpe, não entendi sua pergunta. Digite 'atendente' para falar com alguém..."
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Resposta quando nenhuma regra combinar
                          </p>
                        </div>

                        {/* NEW FIELDS */}
                        <div className="border-t pt-4 space-y-4">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <span>⏸️</span> Configurações de Pausa para Atendimento
                          </h4>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <Label htmlFor="autoPause" className="text-sm font-medium cursor-pointer">
                                  Pausar Automaticamente ao Escalar
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Quando cliente digita a palavra-chave, pausa o chatbot
                                </p>
                              </div>
                              <Switch
                                id="autoPause"
                                checked={autoPauseEnabled}
                                onCheckedChange={setAutoPauseEnabled}
                              />
                            </div>

                            {autoPauseEnabled && (
                              <div>
                                <Label htmlFor="pauseDuration" className="text-sm font-medium">
                                  Duração da Pausa (minutos)
                                </Label>
                                <Input
                                  id="pauseDuration"
                                  type="number"
                                  min="1"
                                  max="120"
                                  value={pauseDurationMinutes}
                                  onChange={(e) => setPauseDurationMinutes(Number(e.target.value))}
                                  className="mt-1"
                                  placeholder="30"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Quantos minutos o chatbot fica pausado enquanto atendente conversa
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={handleSaveConfig}
                            disabled={saveLoading}
                            className="flex-1"
                          >
                            {saveLoading ? '⏳ Salvando...' : '💾 Salvar Alterações'}
                          </Button>
                          <Button
                            onClick={() => {
                              setEditMode(false);
                              // Reset to previous values
                              if (config) {
                                setTimeoutSeconds(config.response_timeout_seconds || 30);
                                const keywordsString = (config.escalation_keywords || ['atendente']).join(', ');
                                setEscalationKeywords(keywordsString);
                                setFallbackMessage(config.fallback_message || '');
                                setPauseDurationMinutes(config.pause_duration_minutes || 30);
                                setAutoPauseEnabled(config.auto_pause_on_escalation !== false);
                              }
                            }}
                            variant="outline"
                            className="flex-1"
                            disabled={saveLoading}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RULES TAB */}
        <TabsContent value="rules" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Regras de FAQ</h3>
              <p className="text-sm text-muted-foreground">
                Defina padrões e respostas automáticas para cada tipo de pergunta
              </p>
            </div>

            <Dialog
              open={showNewRuleDialog}
              onOpenChange={(open) => {
                setShowNewRuleDialog(open);
                // Reset form quando abre/fecha dialog
                if (!open) {
                  setNewRuleKeywords('');
                  setNewRuleIntent('hours');
                  setNewRuleResponse(INTENT_TEMPLATES['hours']);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Nova Regra</DialogTitle>
                  <DialogDescription>
                    Defina um padrão de perguntas e suas respostas automáticas
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Pergunta</Label>
                    <Select value={newRuleIntent} onValueChange={setNewRuleIntent}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTENT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Palavras-chave (separadas por vírgula)</Label>
                    <Textarea
                      placeholder={KEYWORD_EXAMPLES[newRuleIntent] || 'palavra-chave1, palavra-chave2, palavra-chave3'}
                      value={newRuleKeywords}
                      onChange={(e) => setNewRuleKeywords(e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Resposta Automática</Label>
                    <Textarea
                      placeholder="Escreva a resposta que será enviada..."
                      value={newRuleResponse}
                      onChange={(e) => setNewRuleResponse(e.target.value)}
                      className="mt-1"
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={handleAddRule}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Regra
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* EDIT RULE DIALOG */}
            <Dialog
              open={!!editingRule}
              onOpenChange={(open) => {
                if (!open) {
                  setEditingRule(null);
                  setNewRuleKeywords('');
                  setNewRuleIntent('hours');
                  setNewRuleResponse(INTENT_TEMPLATES['hours']);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Editar Regra</DialogTitle>
                  <DialogDescription>
                    Modifique as palavras-chave e respostas desta regra
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Pergunta</Label>
                    <Select value={newRuleIntent} onValueChange={setNewRuleIntent}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTENT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Palavras-chave (separadas por vírgula)</Label>
                    <Textarea
                      placeholder={KEYWORD_EXAMPLES[newRuleIntent] || 'palavra-chave1, palavra-chave2, palavra-chave3'}
                      value={newRuleKeywords}
                      onChange={(e) => setNewRuleKeywords(e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Resposta Automática</Label>
                    <Textarea
                      placeholder="Escreva a resposta que será enviada..."
                      value={newRuleResponse}
                      onChange={(e) => setNewRuleResponse(e.target.value)}
                      className="mt-1"
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={handleUpdateRule}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Atualizar Regra
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Rules Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Palavras-chave</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma regra criada. Crie uma para começar! 🚀
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Badge variant="outline">{INTENT_LABELS[rule.intent] || rule.intent}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {rule.keywords.slice(0, 2).join(', ')}
                          {rule.keywords.length > 2 && ` (+${rule.keywords.length - 2})`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={rule.enabled ? 'default' : 'secondary'}
                          >
                            {rule.enabled ? '✅ Ativa' : '⏸️ Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRule(rule)}
                            title="Editar regra"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleRule(rule)}
                          >
                            {rule.enabled ? '⏸️' : '▶️'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
