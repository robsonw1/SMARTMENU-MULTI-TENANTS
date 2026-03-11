import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsStore } from '@/store/useSettingsStore';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface PrintNodeConfig {
  printerId: string;
  printMode: 'auto' | 'manual';
  autoPrintPix: boolean;
  autoPrintCard: boolean;
  autoPrintCash: boolean;
}

export function PrintNodeSettings() {
  const [config, setConfig] = useState<PrintNodeConfig>({
    printerId: '',
    printMode: 'auto',
    autoPrintPix: false,
    autoPrintCard: false,
    autoPrintCash: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);
  const syncSettingsToSupabase = useSettingsStore((s) => s.syncSettingsToSupabase);

  // Carregar configurações existentes
  useEffect(() => {
    if (settings) {
      const newConfig: PrintNodeConfig = {
        printerId: settings.printnode_printer_id || '',
        printMode: (settings.print_mode as 'auto' | 'manual') || 'auto',
        autoPrintPix: settings.auto_print_pix === true,
        autoPrintCard: settings.auto_print_card === true,
        autoPrintCash: settings.auto_print_cash === true,
      };
      setConfig(newConfig);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!config.printerId) {
      setMessage({ type: 'error', text: 'Informe o ID da impressora' });
      return;
    }

    setLoading(true);
    try {
      // updateSettings agora salva automaticamente no Supabase
      await updateSettings({
        ...settings,
        printnode_printer_id: config.printerId,
        print_mode: config.printMode,
        auto_print_pix: config.autoPrintPix,
        auto_print_card: config.autoPrintCard,
        auto_print_cash: config.autoPrintCash,
      });

      // ✅ Recarregar FRESH do banco para garantir que reflete IMEDIATAMENTE
      await loadSettingsFromSupabase();
      
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erro ao salvar configurações',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    if (!config.printerId) {
      setMessage({ type: 'error', text: 'Configure o ID da impressora antes de testar' });
      return;
    }

    setIsTesting(true);
    try {
      // Testar impressão chamando a Edge Function
      const { data, error } = await supabase.functions.invoke('printorder', {
        body: {
          orderId: 'TEST-ORDER',
          force: true,
        },
      });

      if (error) {
        setMessage({
          type: 'error',
          text: `Erro ao testar: ${error.message}`,
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Teste enviado com sucesso! Verifique sua impressora.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erro ao testar impressão',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Impressão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="printer-id">ID da Impressora</Label>
            <Input
              id="printer-id"
              placeholder="Ex: 1234567"
              value={config.printerId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, printerId: e.target.value }))
              }
            />
            <p className="text-xs text-gray-500">
              ID numérico da impressora no seu PrintNode
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="print-mode">Modo de Impressão</Label>
            <Select
              value={config.printMode}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  printMode: value as 'auto' | 'manual',
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (imprimir ao confirmar pedido)</SelectItem>
                <SelectItem value="manual">Manual (botão de impressão)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.printMode === 'auto' && (
            <div className="space-y-3 border-t pt-4 animate-in fade-in">
              <Label className="font-semibold">Impressão Automática por Método de Pagamento</Label>
              <p className="text-xs text-gray-500 mb-3">Escolha quais métodos de pagamento devem imprimir automaticamente:</p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={config.autoPrintPix}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        autoPrintPix: !!checked,
                      }))
                    }
                  />
                  <span className="text-sm">PIX - Imprimir automaticamente</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={config.autoPrintCard}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        autoPrintCard: !!checked,
                      }))
                    }
                  />
                  <span className="text-sm">Cartão - Imprimir automaticamente</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={config.autoPrintCash}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        autoPrintCash: !!checked,
                      }))
                    }
                  />
                  <span className="text-sm">Dinheiro - Imprimir automaticamente</span>
                </label>
              </div>
            </div>
          )}
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

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>

          <Button
            onClick={handleTestPrint}
            disabled={isTesting || !config.printerId}
            variant="outline"
          >
            {isTesting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              'Testar Impressão'
            )}
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">💡 Informações:</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>Modo Automático:</strong> Pedidos são impressos automaticamente quando confirmados</li>
            <li>• <strong>Modo Manual:</strong> Use o botão de impressão no histórico de pedidos</li>
            <li>• A chave de API é gerenciada com segurança no servidor</li>
            <li>• Clique em "Testar Impressão" para verificar se tudo está funcionando</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
