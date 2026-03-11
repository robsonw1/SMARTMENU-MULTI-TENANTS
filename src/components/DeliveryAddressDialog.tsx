import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { useNeighborhoodsStore } from '@/store/useNeighborhoodsStore';
import { toast } from 'sonner';
import { MapPin, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryAddressDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeliveryAddressDialog({
  isOpen,
  onClose,
}: DeliveryAddressDialogProps) {
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const saveDefaultAddress = useLoyaltyStore((s) => s.saveDefaultAddress);
  const neighborhoods = useNeighborhoodsStore((s) => s.neighborhoods);
  const activeNeighborhoods = neighborhoods.filter(n => n.isActive);

  const [formData, setFormData] = useState({
    street: currentCustomer?.street || '',
    number: currentCustomer?.number || '',
    complement: currentCustomer?.complement || '',
    neighborhood: currentCustomer?.neighborhood || '',
    city: currentCustomer?.city || '',
    zipCode: currentCustomer?.zipCode || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [neighborhoodInput, setNeighborhoodInput] = useState<string>(currentCustomer?.neighborhood || '');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const [isCreatingNeighborhood, setIsCreatingNeighborhood] = useState(false);

  // Rastrear se já carregou os dados na abertura
  const hasInitializedRef = useRef(false);

  // Sincronizar formData APENAS UMA VEZ quando abre o dialog
  useEffect(() => {
    if (isOpen) {
      // Carregar dados apenas na PRIMEIRA abertura
      if (!hasInitializedRef.current) {
        setFormData({
          street: currentCustomer?.street || '',
          number: currentCustomer?.number || '',
          complement: currentCustomer?.complement || '',
          neighborhood: currentCustomer?.neighborhood || '',
          city: currentCustomer?.city || '',
          zipCode: currentCustomer?.zipCode || '',
        });
        setNeighborhoodInput(currentCustomer?.neighborhood || '');
        hasInitializedRef.current = true;
      }
    } else {
      // Reset o flag quando fecha para que carregue novamente na proxima abertura
      hasInitializedRef.current = false;
    }
  }, [isOpen]); // Seguro - isOpen é o único trigger

  // Filtrar bairros baseado no input do usuário
  const filteredNeighborhoods = activeNeighborhoods.filter((nb) =>
    nb?.name?.toLowerCase().includes(neighborhoodInput.toLowerCase())
  );

  // Verificar se o bairro digitado já existe
  const neighborhoodExists = activeNeighborhoods.some(
    (nb) => nb?.name?.toLowerCase() === neighborhoodInput.toLowerCase()
  );

  // Função para criar novo bairro com taxa padrão
  const handleAddNewNeighborhood = async () => {
    if (!neighborhoodInput.trim()) {
      toast.error('Digite o nome do bairro');
      return;
    }

    setIsCreatingNeighborhood(true);
    try {
      const DEFAULT_DELIVERY_FEE = 8.0; // Taxa padrão em reais
      const newNeighborhoodId = `user-${neighborhoodInput.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Salvar novo bairro no Supabase
      const { error } = await (supabase as any)
        .from('neighborhoods')
        .insert([
          {
            id: newNeighborhoodId,
            name: neighborhoodInput.trim(),
            delivery_fee: DEFAULT_DELIVERY_FEE,
            is_active: true,
          },
        ]);

      if (error) {
        console.error('❌ Erro ao criar bairro:', error);
        toast.error('Erro ao adicionar bairro');
        return;
      }

      // Selecionar o bairro criado
      setFormData({ ...formData, neighborhood: neighborhoodInput.trim() });
      setShowNeighborhoodDropdown(false);
      toast.success(`✅ Bairro "${neighborhoodInput}" adicionado com sucesso!`);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao adicionar bairro');
    } finally {
      setIsCreatingNeighborhood(false);
    }
  };

  const handleSave = async () => {
    if (!formData.street.trim() || !formData.number.trim() || !neighborhoodInput.trim()) {
      toast.error('Preencha rua, número e bairro obrigatoriamente');
      return;
    }

    setIsLoading(true);
    try {
      // Usar o valor digitado como bairro (pode ser novo ou existente)
      const dataToSave = {
        ...formData,
        neighborhood: neighborhoodInput.trim(),
      };

      const success = await saveDefaultAddress(dataToSave);
      if (success) {
        toast.success('✅ Endereço salvo com sucesso!');
        onClose();
      } else {
        toast.error('Erro ao salvar endereço');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar endereço');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={() => setShowNeighborhoodDropdown(false)}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <DialogTitle>Meu Endereço de Entrega</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Salve seu endereço padrão para agilizar seus pedidos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="zipCode">CEP</Label>
            <Input
              id="zipCode"
              placeholder="00000-000"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Rua *</Label>
            <Input
              id="street"
              placeholder="Rua/Avenida"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                placeholder="123"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                placeholder="Apto, sala..."
                value={formData.complement}
                onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Bairro com Autocomplete inteligente */}
          <div className="space-y-2 relative">
            <Label htmlFor="neighborhood">Bairro *</Label>
            <div className="relative">
              <Input
                id="neighborhood"
                placeholder="Digitar ou selecionar um bairro"
                value={neighborhoodInput}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setNeighborhoodInput(inputValue);
                  setShowNeighborhoodDropdown(true);
                  
                  // 🔍 VALIDAÇÃO: Limpar formData.neighborhood se não corresponde a um bairro existente
                  if (!inputValue.trim()) {
                    setFormData({ ...formData, neighborhood: '' });
                  } else {
                    const matchingNeighborhood = activeNeighborhoods.find(
                      (nb) => nb?.name?.toLowerCase() === inputValue.toLowerCase().trim()
                    );
                    if (!matchingNeighborhood) {
                      // ❌ Não corresponde - manter vazio para forçar seleção explícita
                      setFormData({ ...formData, neighborhood: '' });
                    } else {
                      // ✅ Corresponde - setar formData
                      setFormData({ ...formData, neighborhood: matchingNeighborhood.name });
                    }
                  }
                }}
                onFocus={() => setShowNeighborhoodDropdown(true)}
                disabled={isLoading || isCreatingNeighborhood}
                autoComplete="off"
                className="pr-10"
              />

              {/* Dropdown de bairros com autocomplete */}
              {showNeighborhoodDropdown && neighborhoodInput && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md shadow-md max-h-48 overflow-y-auto">
                  {/* Bairros que combinam com a busca */}
                  {filteredNeighborhoods.length > 0 && (
                    <>
                      {filteredNeighborhoods.map((nb) =>
                        !nb?.id ? null : (
                          <button
                            key={nb.id}
                            type="button"
                            onClick={() => {
                              setNeighborhoodInput(nb.name);
                              setFormData({ ...formData, neighborhood: nb.name });
                              setShowNeighborhoodDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between items-center border-b last:border-b-0"
                          >
                            <span className="text-sm">{nb.name}</span>
                            <span className="text-xs text-muted-foreground">{formatPrice(nb.deliveryFee)}</span>
                          </button>
                        )
                      )}
                    </>
                  )}

                  {/* Opção para criar novo bairro se não existir */}
                  {!neighborhoodExists && neighborhoodInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddNewNeighborhood}
                      disabled={isCreatingNeighborhood}
                      className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-green-950 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-primary text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar "{neighborhoodInput}" como novo bairro</span>
                      {isCreatingNeighborhood && <span className="ml-auto text-xs">Criando...</span>}
                    </button>
                  )}

                  {/* Mensagem quando nenhum bairro encontrado */}
                  {filteredNeighborhoods.length === 0 && !neighborhoodInput.trim() && (
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      Digite para buscar bairros
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input
              id="city"
              placeholder="Cidade"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-muted-foreground">
            <p>💡 Este endereço será usado como padrão em todos os seus pedidos de entrega.</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Salvando...' : 'Salvar Endereço'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
