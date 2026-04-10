import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';

interface DelayConfig {
  delayBeforeEachMsg: number; // segundos
  delayAfterXMessages: number; // quantidade de mensagens
  delayAfterXMessageSeconds: number; // segundos
}

interface DelayConfigTabProps {
  config: DelayConfig;
  onConfigChange: (config: DelayConfig) => void;
}

export function DelayConfigTab({ config, onConfigChange }: DelayConfigTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Configuração de Atrasos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Delay before each message */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Aguarda X segundos ANTES de cada mensagem</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo de espera antes de enviar cada uma das 5 mensagens
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="600"
                  value={config.delayBeforeEachMsg}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      delayBeforeEachMsg: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-20 text-center"
                />
                <span className="text-sm font-medium">segundos</span>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                ⏱️ Exemplo: 2 segundos = cada mensagem será enviada com 2 segundos de atraso
              </p>
            </div>
          </div>

          {/* Delay after X messages */}
          <div className="space-y-3">
            <div>
              <Label>Aguarda X segundos APÓS cada Y mensagens</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pausa entre batches de mensagens (para evitar bloqueios)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Após quantas mensagens?</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={config.delayAfterXMessages}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      delayAfterXMessages: parseInt(e.target.value) || 1,
                    })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">1-5 mensagens</p>
              </div>

              <div>
                <Label className="text-sm">Quantos segundos de pausa?</Label>
                <Input
                  type="number"
                  min="0"
                  max="600"
                  value={config.delayAfterXMessageSeconds}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      delayAfterXMessageSeconds: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">0-600 segundos</p>
              </div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-xs text-green-700">
                ⏱️ Exemplo: Após 2 mensagens, aguarda 10 segundos = 
                <br />
                Msg1 → 2s → Msg2 → 10s pausa → continua
              </p>
            </div>
          </div>

          {/* Visual Preview */}
          <div className="space-y-2">
            <Label>Simulação de Envio</Label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-xs space-y-1">
              <div>
                <span className="text-blue-600">→</span> Mensagem 1
              </div>
              <div className="text-muted-foreground">
                ⏱️ Aguarda {config.delayBeforeEachMsg}s
              </div>
              <div>
                <span className="text-blue-600">→</span> Mensagem 2
              </div>
              <div className="text-muted-foreground">
                ⏱️ Aguarda {config.delayBeforeEachMsg}s
              </div>
              {config.delayAfterXMessages <= 2 && (
                <div className="text-green-600 font-bold">
                  ⏸️ PAUSA: {config.delayAfterXMessageSeconds}s (após 2 mensagens)
                </div>
              )}
              <div>
                <span className="text-blue-600">→</span> Mensagem 3
              </div>
              <div className="text-muted-foreground">
                ⏱️ Aguarda {config.delayBeforeEachMsg}s
              </div>
              <div>
                <span className="text-blue-600">→</span> Mensagem 4
              </div>
              <div className="text-muted-foreground">
                ⏱️ Aguarda {config.delayBeforeEachMsg}s
              </div>
              {config.delayAfterXMessages <= 4 && (
                <div className="text-green-600 font-bold">
                  ⏸️ PAUSA: {config.delayAfterXMessageSeconds}s
                </div>
              )}
              <div>
                <span className="text-blue-600">→</span> Mensagem 5
              </div>
              <div className="text-green-600 font-bold">✅ Ciclo completo</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configurações Recomendadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Rápido:</strong> 1s antes, após 2 msgs → 5s
          </p>
          <p>
            <strong>Normal (padrão):</strong> 2s antes, após 2 msgs → 10s
          </p>
          <p>
            <strong>Seguro:</strong> 3s antes, após 2 msgs → 15s
          </p>
          <p>
            <strong>Muito conservador:</strong> 5s antes, após 1 msg → 30s
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
