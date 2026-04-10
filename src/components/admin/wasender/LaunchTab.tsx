import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LaunchConfig {
  name: string;
  description: string;
}

interface LaunchTabProps {
  config: LaunchConfig;
  onConfigChange: (config: LaunchConfig) => void;
  totalContacts: number;
  onSchedule: () => void;
  onLaunchNow: () => void;
  isLoading?: boolean;
}

export function LaunchTab({
  config,
  onConfigChange,
  totalContacts,
  onSchedule,
  onLaunchNow,
  isLoading = false,
}: LaunchTabProps) {
  const canLaunch = config.name.trim() && totalContacts > 0;

  const handleLaunchNow = () => {
    if (!canLaunch) {
      toast.error('Preencha nome e adicione contatos');
      return;
    }
    onLaunchNow();
  };

  const handleSchedule = () => {
    if (!canLaunch) {
      toast.error('Preencha nome e adicione contatos');
      return;
    }
    onSchedule();
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalContacts}</p>
              <p className="text-xs text-muted-foreground">Contatos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">5</p>
              <p className="text-xs text-muted-foreground">Mensagens</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">~{totalContacts * 5}</p>
              <p className="text-xs text-muted-foreground">Total de Msgs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Campanha *</Label>
            <Input
              placeholder="Ex: Black Friday 2026"
              value={config.name}
              onChange={(e) => onConfigChange({ ...config, name: e.target.value })}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Identificação da campanha (obrigatório)
            </p>
          </div>

          <div>
            <Label>Descrição (Opcional)</Label>
            <Textarea
              placeholder="Descrição interna da campanha..."
              value={config.description}
              onChange={(e) => onConfigChange({ ...config, description: e.target.value })}
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {totalContacts === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Sem contatos</p>
            <p className="text-sm text-yellow-800 mt-1">
              Adicione contatos na aba "Contatos" antes de lançar a campanha
            </p>
          </div>
        </div>
      )}

      {!config.name.trim() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Nome obrigatório</p>
            <p className="text-sm text-yellow-800 mt-1">
              Digite um nome para identificar a campanha
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={handleLaunchNow}
          disabled={!canLaunch || isLoading}
          size="lg"
          className="bg-green-600 hover:bg-green-700"
        >
          <Send className="w-4 h-4 mr-2" />
          INICIAR AGORA
        </Button>

        <Button
          onClick={handleSchedule}
          disabled={!canLaunch || isLoading}
          variant="outline"
          size="lg"
        >
          <Calendar className="w-4 h-4 mr-2" />
          AGENDAR
        </Button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
        <p className="font-medium text-blue-900">ℹ️ Como funciona</p>
        <ul className="text-blue-800 space-y-1 text-xs list-disc list-inside">
          <li>Clique em "INICIAR AGORA" para começar imediatamente</li>
          <li>Clique em "AGENDAR" para definir data e hora</li>
          <li>Você poderá pausar, parar ou editar a campanha durante execução</li>
          <li>Acompanhe status e analytics em tempo real</li>
        </ul>
      </div>
    </div>
  );
}
