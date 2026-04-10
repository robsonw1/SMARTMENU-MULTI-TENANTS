import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  X,
  Edit2,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExecutionLog {
  id: string;
  customer_phone: string;
  customer_name: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  message_sequence: number;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  started_at?: string;
  scheduled_at?: string;
}

interface DashboardProps {
  campaign: Campaign;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const STATUS_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600', label: '⏳ Aguardando' },
  sent: { icon: CheckCircle, color: 'text-blue-600', label: '✉️ Enviada' },
  delivered: { icon: CheckCircle, color: 'text-green-600', label: '✅ Entregue' },
  read: { icon: CheckCircle, color: 'text-green-700', label: '👁️ Lida' },
  failed: { icon: AlertCircle, color: 'text-red-600', label: '❌ Falha' },
};

export function CampaignExecutionDashboard({
  campaign,
  onStatusChange,
  onDelete,
  onEdit,
}: DashboardProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    total: 0,
  });

  useEffect(() => {
    loadExecutionLogs();
    const interval = setInterval(loadExecutionLogs, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [campaign.id]);

  const loadExecutionLogs = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('campaign_execution_log')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const newStats = {
        pending: data?.filter((l: any) => l.status === 'pending').length || 0,
        sent: data?.filter((l: any) => l.status === 'sent').length || 0,
        delivered: data?.filter((l: any) => l.status === 'delivered').length || 0,
        read: data?.filter((l: any) => l.status === 'read').length || 0,
        failed: data?.filter((l: any) => l.status === 'failed').length || 0,
        total: data?.length || 0,
      };
      setStats(newStats);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      const { error } = await (supabase as any)
        .from('wasender_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign.id);

      if (error) throw error;
      toast.success('✅ Campanha pausada');
      onStatusChange?.('paused');
    } catch (err) {
      toast.error('Erro ao pausar campanha');
    }
  };

  const handleResume = async () => {
    try {
      const { error } = await (supabase as any)
        .from('wasender_campaigns')
        .update({ status: 'running' })
        .eq('id', campaign.id);

      if (error) throw error;
      toast.success('✅ Campanha retomada');
      onStatusChange?.('running');
    } catch (err) {
      toast.error('Erro ao retomar campanha');
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Tem certeza? A campanha será encerrada.')) return;

    try {
      const { error } = await (supabase as any)
        .from('wasender_campaigns')
        .update({ status: 'stopped', ended_at: new Date().toISOString() })
        .eq('id', campaign.id);

      if (error) throw error;
      toast.success('✅ Campanha encerrada');
      onStatusChange?.('stopped');
    } catch (err) {
      toast.error('Erro ao encerrar campanha');
    }
  };

  const deliveryRate = stats.total > 0 ? ((stats.delivered + stats.read) / stats.total) * 100 : 0;
  const successRate = stats.total > 0 ? ((stats.delivered + stats.read + stats.sent) / stats.total) * 100 : 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      running: 'default',
      paused: 'secondary',
      stopped: 'destructive',
      completed: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">{campaign.name}</h3>
          <p className="text-sm text-muted-foreground">
            Status: {getStatusBadge(campaign.status)}
          </p>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'running' && (
            <>
              <Button size="sm" variant="outline" onClick={handlePause}>
                <Pause className="w-4 h-4 mr-1" />
                Pausar
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop}>
                <X className="w-4 h-4 mr-1" />
                Parar
              </Button>
            </>
          )}
          {campaign.status === 'paused' && (
            <>
              <Button size="sm" onClick={handleResume}>
                <Play className="w-4 h-4 mr-1" />
                Retomar
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop}>
                <X className="w-4 h-4 mr-1" />
                Parar
              </Button>
            </>
          )}
          {['stopped', 'completed'].includes(campaign.status) && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Remover
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.delivered + stats.read}
              </p>
              <p className="text-xs text-muted-foreground">Entregues</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Taxa Entrega</span>
              <span className="font-bold">{deliveryRate.toFixed(1)}%</span>
            </div>
            <Progress value={deliveryRate} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Taxa Sucesso</span>
              <span className="font-bold">{successRate.toFixed(1)}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Execution Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Log de Execução</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro de execução ainda
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Msg</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Horário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 20).map((log) => {
                    const statusInfo = STATUS_ICONS[log.status];
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          +55 {log.customer_phone}
                        </TableCell>
                        <TableCell className="text-sm">{log.customer_name}</TableCell>
                        <TableCell className="text-center font-bold">
                          {log.message_sequence}/5
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === 'failed' ? 'destructive' : 'outline'
                            }
                          >
                            {statusInfo?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.sent_at
                            ? new Date(log.sent_at).toLocaleTimeString('pt-BR')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length > 20 && (
        <p className="text-center text-xs text-muted-foreground">
          Mostrando 20 de {logs.length} registros
        </p>
      )}
    </div>
  );
}
