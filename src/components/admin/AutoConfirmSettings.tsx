import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface AutoConfirmConfig {
  autoConfirmPointsPix: boolean;
  autoConfirmPointsCard: boolean;
  autoConfirmPointsCash: boolean;
  autoConfirmStatusPix: boolean;
  autoConfirmStatusCard: boolean;
  autoConfirmStatusCash: boolean;
  pointsDelayMinutes: number;
}

export function AutoConfirmSettings() {
  const [config, setConfig] = useState<AutoConfirmConfig>({
    autoConfirmPointsPix: false,
    autoConfirmPointsCard: false,
    autoConfirmPointsCash: false,
    autoConfirmStatusPix: false,
    autoConfirmStatusCard: false,
    autoConfirmStatusCash: false,
    pointsDelayMinutes: 60,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);

  // Carregar configurações existentes
  useEffect(() => {
    if (settings) {
      const newConfig: AutoConfirmConfig = {
        autoConfirmPointsPix: (settings as any).auto_confirm_points_pix === true,
        autoConfirmPointsCard: (settings as any).auto_confirm_points_card === true,
        autoConfirmPointsCash: (settings as any).auto_confirm_points_cash === true,
        autoConfirmStatusPix: (settings as any).auto_confirm_status_pix === true,
        autoConfirmStatusCard: (settings as any).auto_confirm_status_card === true,
        autoConfirmStatusCash: (settings as any).auto_confirm_status_cash === true,
        pointsDelayMinutes: (settings as any).auto_confirm_points_delay_minutes || 60,
      };
      setConfig(newConfig);
    }
  }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({
        ...settings,
        auto_confirm_points_pix: config.autoConfirmPointsPix,
        auto_confirm_points_card: config.autoConfirmPointsCard,
        auto_confirm_points_cash: config.autoConfirmPointsCash,
        auto_confirm_status_pix: config.autoConfirmStatusPix,
        auto_confirm_status_card: config.autoConfirmStatusCard,
        auto_confirm_status_cash: config.autoConfirmStatusCash,
        auto_confirm_points_delay_minutes: config.pointsDelayMinutes,
      } as any);

      // Recarregar FRESH do banco
      await loadSettingsFromSupabase();
      
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erro ao salvar configurações',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🤖 Confirmação Automática de Pedidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AUTO-CONFIRM PONTOS */}
        <div className="space-y-4 border-b pb-6">
          <div>
            <Label className="font-semibold text-base mb-2 block">💰 Auto-Confirmação de Pontos</Label>
            <p className="text-xs text-gray-500 mb-4">
              Ativa automaticamente a movimentação de pontos pendentes para o total do cliente. Se desativado, o admin precisa confirmar manualmente.
            </p>
          </div>

          <div className="space-y-2 ml-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmPointsPix}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmPointsPix: !!checked,
                  }))
                }
              />
              <span className="text-sm">PIX - Confirmar pontos automaticamente</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmPointsCard}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmPointsCard: !!checked,
                  }))
                }
              />
              <span className="text-sm">Cartão - Confirmar pontos automaticamente</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmPointsCash}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmPointsCash: !!checked,
                  }))
                }
              />
              <span className="text-sm">Dinheiro - Confirmar pontos automaticamente</span>
            </label>
          </div>

          {/* DELAY DOS PONTOS */}
          <div className="space-y-2 mt-4 ml-2">
            <Label htmlFor="points-delay" className="text-sm">
              ⏱️ Atraso para Confirmação de Pontos (minutos)
            </Label>
            <Input
              id="points-delay"
              type="number"
              min="1"
              max="1440"
              value={config.pointsDelayMinutes}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  pointsDelayMinutes: Math.max(1, parseInt(e.target.value) || 60),
                }))
              }
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500">
              Padrão: 60 minutos. Define quanto tempo aguardar antes de confirmar pontos automaticamente.
            </p>
          </div>
        </div>

        {/* AUTO-CONFIRM STATUS */}
        <div className="space-y-4">
          <div>
            <Label className="font-semibold text-base mb-2 block">📊 Auto-Confirmação de Status</Label>
            <p className="text-xs text-gray-500 mb-4">
              Ativa automaticamente a mudança de status do pedido de "pendente" para "confirmado". Se desativado, o admin precisa confirmar manualmente.
            </p>
          </div>

          <div className="space-y-2 ml-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmStatusPix}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmStatusPix: !!checked,
                  }))
                }
              />
              <span className="text-sm">PIX - Confirmar status automaticamente</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmStatusCard}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmStatusCard: !!checked,
                  }))
                }
              />
              <span className="text-sm">Cartão - Confirmar status automaticamente</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={config.autoConfirmStatusCash}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoConfirmStatusCash: !!checked,
                  }))
                }
              />
              <span className="text-sm">Dinheiro - Confirmar status automaticamente</span>
            </label>
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            '💾 Salvar Configurações'
          )}
        </Button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">💡 Como funciona:</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>Auto-Confirma Pontos:</strong> Clientes recebem pontos automaticamente após pagamento confirmado</li>
            <li>• <strong>Auto-Confirma Status:</strong> Pedido passa para status "confirmado" sem intervenção manual</li>
            <li>• <strong>Notificações:</strong> WhatsApp é enviado automaticamente quando status muda (se ativado)</li>
            <li>• <strong>Modo Manual:</strong> Desabilite qualquer opção para manter o comportamento manual</li>
            <li>• <strong>PIX:</strong> Já é automático por padrão</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
