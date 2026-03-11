import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bell, Plus, Trash2, QrCode, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsAppInstanceSync } from '@/hooks/use-whatsapp-instance-sync';
import { WhatsAppStatusTemplates } from '@/components/admin/WhatsAppStatusTemplates';

// ✅ Templates padrão em inglês (CORRETO)
const DEFAULT_WHATSAPP_MESSAGES = {
  pending: '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!',
  confirmed: '🍕 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min',
  preparing: '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!',
  delivering: '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min',
  delivered: '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏',
  cancelled: '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!',
};

interface WhatsAppInstance {
  id: string;
  establishment_name: string;
  evolution_instance_name: string;
  qr_code_url: string | null;
  is_connected: boolean;
  created_at: string;
}

export const NotificationsTab = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [establishmentName, setEstablishmentName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ [key: string]: string }>({});
  const [tenantId, setTenantId] = useState<string>('');
  const [loadingTenant, setLoadingTenant] = useState(true);
  
  // Usar hook de sincronização
  useWhatsAppInstanceSync();

  // ✅ NOVO: Garantir que templates existem na primeira carga
  useEffect(() => {
    const initializeTemplates = async () => {
      try {
        // 1. Obter tenant ID
        let storedTenantId = localStorage.getItem('admin-tenant-id');
        
        if (!storedTenantId) {
          const { data: tenants } = await (supabase as any)
            .from('tenants')
            .select('id')
            .limit(1);
          
          if (tenants && tenants.length > 0) {
            storedTenantId = tenants[0].id;
            localStorage.setItem('admin-tenant-id', storedTenantId);
          }
        }

        if (!storedTenantId) return;

        // 2. Verificar se templates existem
        const { data: existingTemplates } = await (supabase as any)
          .from('whatsapp_status_messages')
          .select('status')
          .eq('tenant_id', storedTenantId);

        if (!existingTemplates || existingTemplates.length === 0) {
          console.log('📝 Criando templates padrão de WhatsApp...');
          
          // 3. Criar templates padrão
          const messagesToInsert = Object.entries(DEFAULT_WHATSAPP_MESSAGES).map(([status, message]) => ({
            tenant_id: storedTenantId,
            status,
            message_template: message,
            enabled: true,
          }));

          const { error } = await (supabase as any)
            .from('whatsapp_status_messages')
            .insert(messagesToInsert);

          if (error) {
            console.error('⚠️ Erro ao criar templates:', error);
          } else {
            console.log('✅ Templates padrão criados automaticamente');
            toast.success('✅ Notificações WhatsApp configuradas!');
          }
        } else {
          console.log('✅ Templates já existem:', existingTemplates.map((t: any) => t.status));
        }
      } catch (err) {
        console.error('❌ Erro ao inicializar templates:', err);
      }
    };

    // Executar apenas UMA vez ao montar
    initializeTemplates();
  }, []);

  // Buscar instâncias existentes ao montar
  useEffect(() => {
    loadInstances();
  }, []);

  // Carregar tenant_id quando a modal abre (lazy loading)
  useEffect(() => {
    if (openModal && !tenantId) {
      getTenantIdLazy();
    }
  }, [openModal]);

  const getTenantIdLazy = async () => {
    try {
      setLoadingTenant(true);
      console.log('🔄 Carregando tenant ID (lazy)...');
      
      // Tentar obter tenant_id armazenado
      let storedTenantId = localStorage.getItem('admin-tenant-id');
      
      if (storedTenantId) {
        setTenantId(storedTenantId);
        console.log('✅ Tenant ID do localStorage:', storedTenantId);
      } else {
        // Se não houver, buscar o primeiro tenant padrão
        console.log('📋 Buscando tenant padrão...');
        const { data: tenants } = await (supabase as any)
          .from('tenants')
          .select('id')
          .limit(1);
        
        if (tenants && tenants.length > 0) {
          storedTenantId = tenants[0].id;
          setTenantId(storedTenantId);
          localStorage.setItem('admin-tenant-id', storedTenantId);
          console.log('✅ Tenant padrão encontrado:', storedTenantId);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao carregar tenant:', err);
      toast.error('Erro ao carregar tenant');
    } finally {
      setLoadingTenant(false);
    }
  };

  const loadInstances = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data as WhatsAppInstance[]);
      
      // Subscribe to realtime changes
      const subscription = (supabase as any)
        .channel('whatsapp_instances_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_instances',
          },
          (payload: any) => {
            console.log('Instance updated:', payload);
            loadInstances(); // Recarregar quando há mudanças
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error('Erro ao carregar instâncias:', err);
      toast.error('Erro ao carregar instâncias de WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWhatsApp = async () => {
    if (!establishmentName.trim()) {
      toast.error('Nome do estabelecimento é obrigatório');
      return;
    }

    if (!tenantId) {
      toast.error('Tenant não carregado. Tente novamente.');
      return;
    }

    try {
      setCreatingInstance(true);
      
      // Formatar nome para usar como instance name (sem espaços, lowercase)
      const instanceName = establishmentName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      if (!instanceName) {
        toast.error('Nome do estabelecimento inválido');
        return;
      }

      console.log('📤 Enviando para função:', { establishment_name: establishmentName, instance_name: instanceName, tenant_id: tenantId });

      // Chamar função para criar instância na Evolution API
      const { data, error } = await supabase.functions.invoke(
        'create-whatsapp-instance',
        {
          body: {
            establishment_name: establishmentName,
            instance_name: instanceName,
            tenant_id: tenantId,
          },
        }
      );

      if (error) {
        console.error('❌ Erro na função:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Message:', error.message);
        
        // Tentar extrair mensagem de erro mais útil
        let errorMsg = error?.message || 'Erro desconhecido';
        
        // Se tiver resposta JSON, tentar parsear
        if (error?.context?.response) {
          try {
            const response = await error.context.response.json();
            errorMsg = response?.message || response?.error || errorMsg;
          } catch (e) {
            // Se não conseguir parsear, usar message padrão
          }
        }
        
        throw new Error(errorMsg);
      }

      console.log('✅ Resposta da função:', data);

      if (data?.success) {
        toast.success('Instance de WhatsApp criada com sucesso! Clique em "Criar conexão" para escanear o QR code');
        setEstablishmentName('');
        setOpenModal(false);
        await loadInstances();
      } else {
        throw new Error(data?.message || 'Erro ao criar instância');
      }
    } catch (err: any) {
      console.error('Erro ao criar instância:', err);
      toast.error(err.message || 'Erro ao criar instância de WhatsApp');
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleGenerateQR = async (instance: WhatsAppInstance) => {
    try {
      setGeneratingQR(instance.id);

      // Chamar função para gerar QR code
      const { data, error } = await supabase.functions.invoke(
        'generate-whatsapp-qr',
        {
          body: {
            instance_name: instance.evolution_instance_name,
          },
        }
      );

      if (error) throw error;

      if (data?.qr_code) {
        setQrCodeData({
          ...qrCodeData,
          [instance.id]: data.qr_code,
        });
        toast.success('QR Code gerado! Escaneie com seu WhatsApp Business');
      } else {
        throw new Error('QR code não disponível');
      }
    } catch (err: any) {
      console.error('Erro ao gerar QR code:', err);
      toast.error(err.message || 'Erro ao gerar QR code');
    } finally {
      setGeneratingQR(null);
    }
  };

  const handleDeleteInstance = async (instance: WhatsAppInstance) => {
    if (!window.confirm('Tem certeza que deseja deletar esta instância de WhatsApp?\n\nIsso impedirá de enviar notificações de status e receber resumo de pedidos!')) {
      return;
    }

    try {
      console.log(`🗑️ Deletando instância: ${instance.evolution_instance_name}`);
      
      // Obter tenant_id se não estiver no state
      let currentTenantId = tenantId;
      if (!currentTenantId) {
        currentTenantId = localStorage.getItem('admin-tenant-id') || '';
      }

      // Chamar edge function para deletar da Evolution API e do Supabase
      const { data, error } = await supabase.functions.invoke(
        'delete-whatsapp-instance',
        {
          body: {
            instance_id: instance.id,
            evolution_instance_name: instance.evolution_instance_name,
            tenant_id: currentTenantId,
          },
        }
      );

      if (error) {
        console.error('❌ Erro ao deletar instância:', error);
        throw error;
      }

      console.log(`✅ Resposta da deleção:`, data);

      // Verificar se foi deletado
      if (data?.success) {
        if (data?.evolutionDeleted) {
          toast.success('✅ Instância deletada do sistema');
        } else {
          // Mesmo que Evolution tenha falhado, Supabase foi deletado
          toast.success('✅ Instância removida do sistema\n⚠️  WhatsApp pode estar indisponível');
        }
      } else {
        throw new Error(data?.message || 'Erro desconhecido ao deletar instância');
      }

      // Recarregar lista de instâncias
      await loadInstances();
    } catch (err) {
      console.error('❌ Erro ao deletar instância:', err);
      toast.error(`Erro ao deletar instância: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as instâncias de WhatsApp para enviar notificações de pedidos
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadInstances}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Instância WhatsApp</DialogTitle>
                <DialogDescription>
                  Crie uma nova instância de WhatsApp para enviar notificações
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="establishment">Nome do Estabelecimento</Label>
                  <Input
                    id="establishment"
                    placeholder="Ex: Pizzaria Santos, Forneiro Centro"
                    value={establishmentName}
                    onChange={(e) => setEstablishmentName(e.target.value)}
                    disabled={creatingInstance}
                  />
                </div>

                {loadingTenant ? (
                  <Button disabled className="w-full" variant="secondary">
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Carregando tenant...
                  </Button>
                ) : (
                  <Button
                    onClick={handleAddWhatsApp}
                    disabled={creatingInstance || !establishmentName.trim()}
                    className="w-full"
                  >
                    {creatingInstance ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Salvar Configuração'
                    )}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader className="w-6 h-6 mx-auto animate-spin mb-2" />
            Carregando instâncias...
          </CardContent>
        </Card>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Nenhuma instância de WhatsApp configurada
            </p>
            <Button onClick={() => setOpenModal(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instances.map((instance) => (
            <Card key={instance.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{instance.establishment_name}</CardTitle>
                    <CardDescription className="text-xs">
                      {instance.evolution_instance_name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {instance.is_connected ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* QR Code */}
                {selectedInstanceId === instance.id && qrCodeData[instance.id] ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Escaneie o QR code com seu WhatsApp Business:
                    </p>
                    <div className="bg-white p-4 rounded-lg border flex items-center justify-center">
                      <img
                        src={qrCodeData[instance.id]}
                        alt="QR Code"
                        className="w-32 h-32"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setSelectedInstanceId(null)}
                    >
                      Fechar QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        setSelectedInstanceId(instance.id);
                        handleGenerateQR(instance);
                      }}
                      disabled={
                        instance.is_connected ||
                        generatingQR === instance.id
                      }
                    >
                      {generatingQR === instance.id ? (
                        <>
                          <Loader className="w-3 h-3 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          {instance.is_connected ? 'Conectado' : 'Criar Conexão'}
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteInstance(instance)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Status */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Status:</p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        instance.is_connected ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></div>
                    <span className="text-sm font-medium">
                      {instance.is_connected ? 'Conectado' : 'Aguardando conexão'}
                    </span>
                  </div>
                </div>

                {/* Criado em */}
                <p className="text-xs text-muted-foreground">
                  Criado em {new Date(instance.created_at).toLocaleDateString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Separador */}
      <div className="my-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border"></div>
          <p className="text-sm font-semibold text-muted-foreground">Configurações Avançadas</p>
          <div className="flex-1 h-px bg-border"></div>
        </div>
      </div>

      {/* Configurar Templates */}
      <WhatsAppStatusTemplates />
    </div>
  );
};
