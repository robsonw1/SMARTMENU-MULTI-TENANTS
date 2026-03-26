import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pizza,
  Palette,
  Settings,
  Bell,
  Heart,
  Save,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantSettings } from '@/hooks/use-tenant-settings';

export const TenantSettingsPanel = () => {
  const tenantId = localStorage.getItem('admin-tenant-id');
  const { settings, isLoading, error, updateSettings } = useTenantSettings(tenantId || '');

  const [form, setForm] = useState<any>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar settings quando carregarem
  useEffect(() => {
    if (settings) {
      setForm(settings);
      setIsDirty(false);
    }
  }, [settings]);

  const handleFieldChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!tenantId || !isDirty) return;

    setIsSaving(true);
    try {
      await updateSettings(form);
      toast.success('Configurações salvas com sucesso!');
      setIsDirty(false);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações da Loja</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        </CardContent>
      </Card>
    );
  }

  if (error || !settings) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Configurações da Loja</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {error || 'Erro ao carregar configurações'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações da Loja
            </CardTitle>
            <CardDescription>Customize sua loja e ative/desative recursos</CardDescription>
          </div>
          {isDirty && (
            <Badge variant="secondary" className="animate-pulse">
              Alterações não salvas
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="cardapio" className="flex items-center gap-2">
              <Pizza className="w-4 h-4" />
              Cardápio
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="fidelizacao" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Fidelização
            </TabsTrigger>
          </TabsList>

          {/* TAB: Branding */}
          <TabsContent value="branding" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Básicas</h3>

              <div>
                <Label htmlFor="store_name">Nome da Loja</Label>
                <Input
                  id="store_name"
                  value={form.store_name || ''}
                  onChange={(e) => handleFieldChange('store_name', e.target.value)}
                  placeholder="Pizzaria Forneiro Éden"
                />
              </div>

              <div>
                <Label htmlFor="store_description">Descrição</Label>
                <textarea
                  id="store_description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  value={form.store_description || ''}
                  onChange={(e) => handleFieldChange('store_description', e.target.value)}
                  placeholder="Descreva sua loja..."
                />
              </div>

              <Separator />
              <h3 className="text-lg font-semibold">Cores e Logo</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={form.primary_color || '#FF6B35'}
                      onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={form.primary_color || '#FF6B35'}
                      onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                      placeholder="#FF6B35"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondary_color">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={form.secondary_color || '#F7931E'}
                      onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={form.secondary_color || '#F7931E'}
                      onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                      placeholder="#F7931E"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="store_logo_url">URL Logo</Label>
                <Input
                  id="store_logo_url"
                  value={form.store_logo_url || ''}
                  onChange={(e) => handleFieldChange('store_logo_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <Separator />
              <h3 className="text-lg font-semibold">Localização</h3>

              <div>
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Select
                  value={form.timezone || 'America/Sao_Paulo'}
                  onValueChange={(value) => handleFieldChange('timezone', value)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">São Paulo (UTC-3)</SelectItem>
                    <SelectItem value="America/Recife">Recife (UTC-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (UTC-4)</SelectItem>
                    <SelectItem value="America/Porto_Velho">Porto Velho (UTC-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Cardápio */}
          <TabsContent value="cardapio" className="space-y-6">
            <Alert>
              <Pizza className="w-4 h-4" />
              <AlertDescription>
                Use os toggles abaixo para ativar/desativar recursos do cardápio
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Meia-meia</Label>
                  <p className="text-sm text-gray-600">Permitir que clientes peçam meia-meia</p>
                </div>
                <Switch
                  checked={form.meia_meia_enabled}
                  onCheckedChange={(value) => handleFieldChange('meia_meia_enabled', value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Imagens nos Produtos</Label>
                  <p className="text-sm text-gray-600">Exibir fotos do cardápio</p>
                </div>
                <Switch
                  checked={form.imagens_enabled}
                  onCheckedChange={(value) => handleFieldChange('imagens_enabled', value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Adicionais</Label>
                  <p className="text-sm text-gray-600">Permitir adicionais nas pizzas</p>
                </div>
                <Switch
                  checked={form.adicionais_enabled}
                  onCheckedChange={(value) => handleFieldChange('adicionais_enabled', value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Bebidas</Label>
                  <p className="text-sm text-gray-600">Incluir categoria de bebidas</p>
                </div>
                <Switch
                  checked={form.bebidas_enabled}
                  onCheckedChange={(value) => handleFieldChange('bebidas_enabled', value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Bordas</Label>
                  <p className="text-sm text-gray-600">Permitir escolher tipos de borda</p>
                </div>
                <Switch
                  checked={form.bordas_enabled}
                  onCheckedChange={(value) => handleFieldChange('bordas_enabled', value)}
                />
              </div>

              <Separator />

              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label className="text-base font-medium flex items-center gap-2">
                  ⭐ A Moda do Cliente
                </Label>
                <p className="text-sm text-gray-700">
                  Cliente escolhe até N ingredientes grátis. Ative para usar este recurso.
                </p>

                <div className="flex items-center justify-between pt-3">
                  <div>
                    <Label className="text-sm">Ativar</Label>
                  </div>
                  <Switch
                    checked={form.free_ingredients_enabled}
                    onCheckedChange={(value) => handleFieldChange('free_ingredients_enabled', value)}
                  />
                </div>

                {form.free_ingredients_enabled && (
                  <div className="pt-3 border-t">
                    <Label>Máximo de Ingredientes Grátis: {form.free_ingredients_max}</Label>
                    <Slider
                      value={[form.free_ingredients_max || 6]}
                      onValueChange={([value]) => handleFieldChange('free_ingredients_max', value)}
                      min={3}
                      max={12}
                      step={1}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Cliente poderá escolher até {form.free_ingredients_max} ingredientes sem custo adicional.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB: Notificações */}
          <TabsContent value="notificacoes" className="space-y-6">
            <Alert>
              <Bell className="w-4 h-4" />
              <AlertDescription>
                Configure como seus clientes serão notificados sobre pedidos
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Notificações WhatsApp</Label>
                  <p className="text-sm text-gray-600">Enviar atualizações por WhatsApp</p>
                </div>
                <Switch
                  checked={form.whatsapp_notifications_enabled}
                  onCheckedChange={(value) => handleFieldChange('whatsapp_notifications_enabled', value)}
                />
              </div>

              {form.whatsapp_notifications_enabled && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Label htmlFor="whatsapp_phone">Número WhatsApp Padrão</Label>
                  <Input
                    id="whatsapp_phone"
                    value={form.whatsapp_phone_number || ''}
                    onChange={(e) => handleFieldChange('whatsapp_phone_number', e.target.value)}
                    placeholder="(85) 99999-9999"
                    className="mt-2"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Notificações por Email</Label>
                  <p className="text-sm text-gray-600">Enviar resumos por email</p>
                </div>
                <Switch
                  checked={form.email_notifications_enabled}
                  onCheckedChange={(value) => handleFieldChange('email_notifications_enabled', value)}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB: Fidelização */}
          <TabsContent value="fidelizacao" className="space-y-6">
            <Alert>
              <Heart className="w-4 h-4" />
              <AlertDescription>
                Configure como seus clientes acumulam e usam pontos
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Programa de Fidelização</Label>
                  <p className="text-sm text-gray-600">Ativar sistema de pontos</p>
                </div>
                <Switch
                  checked={form.loyalty_enabled}
                  onCheckedChange={(value) => handleFieldChange('loyalty_enabled', value)}
                />
              </div>

              {form.loyalty_enabled && (
                <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div>
                    <Label htmlFor="loyalty_points">
                      Percentual de Pontos: {form.loyalty_points_percentage}%
                    </Label>
                    <p className="text-xs text-gray-600 mb-2">
                      Cada R$ 100 = {form.loyalty_points_percentage} pontos
                    </p>
                    <Slider
                      value={[form.loyalty_points_percentage || 1]}
                      onValueChange={([value]) => handleFieldChange('loyalty_points_percentage', value)}
                      min={0.5}
                      max={5}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label htmlFor="loyalty_minimum_order">
                      Valor Mínimo para Ganhar Pontos: R$ {form.loyalty_minimum_order?.toFixed(2) || '20.00'}
                    </Label>
                    <Input
                      id="loyalty_minimum_order"
                      type="number"
                      value={form.loyalty_minimum_order || 20}
                      onChange={(e) => handleFieldChange('loyalty_minimum_order', parseFloat(e.target.value))}
                      step="5"
                      min="0"
                      className="mt-2"
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setForm(settings);
              setIsDirty(false);
            }}
            disabled={!isDirty || isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="btn-cta"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
