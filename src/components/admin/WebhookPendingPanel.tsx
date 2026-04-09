import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface PendingWebhook {
  id: string;
  tenant_id: string;
  establishment_name: string;
  evolution_instance_name: string;
  webhook_pending: boolean;
  webhook_configured_at: string | null;
  is_connected: boolean;
  created_at: string;
  created_at_readable?: string;
}

/**
 * 🔔 SUPER ADMIN PANEL
 * Rastreia instâncias WhatsApp com webhooks pendentes de configuração
 * Permite marcar webhooks como configurados após o setup manual
 */
export const WebhookPendingPanel = () => {
  const [pendingWebhooks, setPendingWebhooks] = useState<PendingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load pending webhooks
  useEffect(() => {
    loadPendingWebhooks();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadPendingWebhooks, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingWebhooks = async () => {
    try {
      setRefreshing(true);

      // 🔍 QUERY: Buscar todas as instâncias com webhook pendente
      const { data, error } = await (supabase as any)
        .from('whatsapp_instances')
        .select('*')
        .eq('webhook_pending', true)
        .eq('is_connected', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar webhooks pendentes:', error);
        toast.error('Erro ao carregar webhooks pendentes');
        return;
      }

      if (data) {
        const formatted = data.map((webhook: any) => ({
          ...webhook,
          created_at_readable: new Date(webhook.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
        setPendingWebhooks(formatted);
      }
    } catch (err) {
      console.error('❌ Erro:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkAsConfigured = async (webhook: PendingWebhook) => {
    if (!window.confirm(`Confirmar que o webhook foi configurado para ${webhook.establishment_name}?`)) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('whatsapp_instances')
        .update({
          webhook_pending: false,
          webhook_configured_at: new Date().toISOString(),
        })
        .eq('id', webhook.id);

      if (error) throw error;

      // Remove da lista local
      setPendingWebhooks(pendingWebhooks.filter((w) => w.id !== webhook.id));
      toast.success(`✅ Webhook de ${webhook.establishment_name} marcado como configurado!`);

      // 🔔 Notify establishment
      try {
        await (supabase as any)
          .from('admin_notifications')
          .insert({
            type: 'webhook_configured',
            title: '✅ Webhook Configurado',
            message: 'Seu webhook WhatsApp foi configurado com sucesso! O chatbot começará a funcionar em breve.',
            tenant_id: webhook.tenant_id,
          });
      } catch (notifErr) {
        console.warn('⚠️ Erro ao notificar estabelecimento:', notifErr);
      }
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao marcar webhook como configurado');
    }
  };

  if (loading) {
    return <div className="p-6">Carregando webhooks pendentes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold">Webhooks Pendentes</h3>
            <p className="text-sm text-muted-foreground">
              Instâncias WhatsApp aguardando configuração de webhook
            </p>
          </div>
        </div>
        <Badge variant="destructive" className="text-base px-3 py-1">
          {pendingWebhooks.length} Pendente{pendingWebhooks.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Ações Necessárias
          </CardTitle>
          <CardDescription>
            Para cada webhook pendente, acesse o dashboard da Evolution API e configure a URL do webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingWebhooks.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold">Todos os webhooks configurados! ✅</p>
              <p className="text-sm text-muted-foreground">
                Nenhum webhook aguardando configuração no momento
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estabelecimento</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Ativado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingWebhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">
                      {webhook.establishment_name || 'Sem nome'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {webhook.evolution_instance_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {webhook.created_at_readable}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50">
                        ⏳ Pendente
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsConfigured(webhook)}
                        disabled={refreshing}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Configurado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      {pendingWebhooks.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">📋 Como Configurar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-blue-900">1. Para cada webhook pendente:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Acesse o dashboard da Evolution API</li>
                <li>Vá para Settings → Webhooks</li>
                <li>Clique em "Add Webhook"</li>
                <li>Cole a URL:</li>
              </ol>
              <div className="bg-white p-3 rounded border border-blue-200 font-mono text-xs mt-2 break-all">
                {`${window.location.origin}/functions/v1/handle-chatbot-incoming-message`}
              </div>
              <ol start={5} className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Selecione o evento: <code className="bg-white px-1">messages.upsert</code></li>
                <li>Salve e clique "Confirmar" no painel acima</li>
              </ol>
            </div>
            <p className="text-blue-700 font-semibold mt-3">
              ⏱️ O chatbot começará a funcionar em breve após a configuração
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
