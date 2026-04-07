import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Order } from '@/data/products';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { OrderItemDetails } from './OrderItemDetailsRenderer';

type OrderStatus = 'pending' | 'agendado' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendente',
  agendado: 'Agendado',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  delivering: 'Em Entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500',
  agendado: 'bg-blue-600',
  confirmed: 'bg-blue-500',
  preparing: 'bg-orange-500',
  delivering: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

export function OrderDetailsDialog({ open, onOpenChange, order }: OrderDetailsDialogProps) {
  const updateOrderStatus = useOrdersStore((s) => s.updateOrderStatus);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [localOrder, setLocalOrder] = useState<Order | null>(order);

  // 🔄 Carregar pedido FRESCO do banco quando o dialog abre (para garantir campos como change_amount)
  useEffect(() => {
    if (!open || !order?.id) return;

    const loadFreshOrder = async () => {
      try {
        const response = await supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .single() as any;

        const { data: freshOrderRaw, error } = response;

        if (error) {
          console.error('[ADMIN] Erro ao carregar pedido fresco:', error);
          return;
        }

        if (!freshOrderRaw) {
          console.warn('[ADMIN] Pedido não encontrado no banco:', order.id);
          return;
        }

        // Reconstruir o address exatamente como o syncOrdersFromSupabase faz
        const addressFromBank = freshOrderRaw.address || {};
        
        const reconstructedAddress = {
          city: addressFromBank.city || order.address?.city || '',
          neighborhood: addressFromBank.neighborhood || order.address?.neighborhood || '',
          street: addressFromBank.street || order.address?.street || '',
          number: addressFromBank.number || order.address?.number || '',
          complement: addressFromBank.complement || order.address?.complement || '',
          reference: addressFromBank.reference || order.address?.reference || '',
          change_amount: addressFromBank.change_amount || undefined,
        };

        // Atualizar localOrder com dados frescos
        setLocalOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            address: reconstructedAddress,
          };
        });
      } catch (err) {
        console.error('[ADMIN] Erro ao carregar pedido fresco:', err);
      }
    };

    loadFreshOrder();
  }, [open, order?.id]);

  // 🔴 REALTIME: Monitorar mudanças no status da ordem para refrescar UI
  useEffect(() => {
    if (!open || !order?.id) return;

    console.log('🔴 [ADMIN] Setting up Realtime order status sync for order:', order.id);

    const channel = supabase.channel(`order-status-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`
        },
        (payload: any) => {
          const updatedOrder = payload.new;
          console.log('🔴 [ADMIN] Ordem atualizada em tempo real:', {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            pointsRedeemed: updatedOrder.points_redeemed,
            pendingPoints: updatedOrder.pending_points,
            addressChangeAmount: updatedOrder.address?.change_amount,
            timestamp: new Date().toISOString()
          });

          // ✨ ATUALIZAR O ESTADO LOCAL DO ORDER
          setLocalOrder((prev) => {
            if (!prev) return prev;
            
            // 🔨 Reconstruir address com segurança (não perder change_amount)
            const newAddress = updatedOrder.address ? {
              ...prev.address, // Manter campos existentes
              ...updatedOrder.address, // Sobrescrever apenas o que veio do realtime
              change_amount: updatedOrder.address.change_amount ?? prev.address?.change_amount, // Garantir change_amount
            } : prev.address;
            
            return {
              ...prev,
              status: updatedOrder.status,
              pointsRedeemed: updatedOrder.points_redeemed || 0,
              pendingPoints: updatedOrder.pending_points || 0,
              address: newAddress,
            };
          });

          // Se cancelado, mostrar notificação com detalhes dos pontos
          if (updatedOrder.status === 'cancelled') {
            const pointsReverted = updatedOrder.points_redeemed || 0;
            const pointsLost = updatedOrder.pending_points || 0;
            
            let message = '⏮️ Pedido foi cancelado. ';
            if (pointsReverted > 0) {
              message += `+${pointsReverted} pontos restaurados. `;
            }
            if (pointsLost > 0) {
              message += `${pointsLost} pontos pendentes removidos.`;
            }
            
            toast.info(message || 'Pedido foi cancelado.', {
              duration: 5000
            });
            
            // ✅ NOVO: Sincronizar pontos do cliente IMEDIATAMENTE após cancelamento
            if (localOrder.customer?.email) {
              const findOrCreateCustomer = useLoyaltyStore.getState().findOrCreateCustomer;
              const refreshCurrentCustomer = useLoyaltyStore.getState().refreshCurrentCustomer;
              
              findOrCreateCustomer(localOrder.customer.email).then((customer) => {
                if (customer?.id) {
                  refreshCurrentCustomer(customer.id).then(() => {
                    console.log('[ORDER-CANCEL] ✅ Pontos do cliente sincronizados após cancelamento');

                  }).catch((error) => {
                    console.error('[ORDER-CANCEL] ⚠️ Erro ao sincronizar pontos:', error);
                  });
                }
              });
            }
            
            // Fechar o diálogo após 2 segundos
            setTimeout(() => onOpenChange(false), 2000);
          }
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [ADMIN] Realtime subscription ativo para status de pedidos');
        }
      });

    return () => {
      console.log('🔴 [ADMIN] Unsubscribing from realtime order status sync');
      supabase.removeChannel(channel);
    };
  }, [open, order?.id, onOpenChange]);

  // Sincronizar quando a prop 'order' muda
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  if (!localOrder) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Formatar número para WhatsApp: remove caracteres não numéricos e adiciona código do país
  const formatWhatsAppUrl = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, ''); // Remove tudo que não é número
    const phoneWithCountry = cleanPhone.startsWith('55') 
      ? cleanPhone 
      : `55${cleanPhone}`;
    return `https://wa.me/${phoneWithCountry}?text=Olá`;
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    updateOrderStatus(localOrder.id, newStatus);
    
    // 🔴 SE CANCELADO: Fazer refresh dos pontos do cliente após reversão automática
    if (newStatus === 'cancelled' && localOrder.customer?.email) {
      console.log('[ADMIN] 🔄 Pedido cancelado! Sincronizando pontos do cliente...', localOrder.customer.email);
      
      // Buscar ID do cliente e fazer refresh
      const findOrCreateCustomer = useLoyaltyStore.getState().findOrCreateCustomer;
      const refreshCurrentCustomer = useLoyaltyStore.getState().refreshCurrentCustomer;
      
      findOrCreateCustomer(localOrder.customer.email).then((customer) => {
        if (customer?.id) {
          refreshCurrentCustomer(customer.id).then(() => {
            console.log('[ADMIN] ✅ Pontos sincronizados após cancelamento');
          }).catch((error) => {
            console.error('[ADMIN] ⚠️ Erro ao sincronizar pontos:', error);
          });
        }
      });
      
      toast.success(`Pedido cancelado! Pontos foram revertidos automaticamente.`);
    } else {
      toast.success(`Status alterado para "${statusLabels[newStatus]}"`);
    }
  };

  const handleConfirmPayment = async () => {
    if (!localOrder) return;

    setIsConfirmingPayment(true);
    try {
      // 🔍 VALIDAÇÕES DE SEGURANÇA
      console.log('[ADMIN] ===== INICIANDO CONFIRMAÇÃO DE PAGAMENTO =====');
      console.log('[ADMIN] Dados do pedido:', {
        orderId: localOrder.id,
        customerName: localOrder.customer?.name,
        customerEmail: localOrder.customer?.email,
        total: localOrder.total,
        pointsRedeemed: localOrder.pointsRedeemed,
        paymentMethod: localOrder.paymentMethod,
        status: localOrder.status
      });

      // Validar que o pedido tem ID e valor
      if (!localOrder.id || typeof localOrder.id !== 'string') {
        console.error('[ADMIN] ❌ Order ID inválido:', localOrder.id);
        toast.error('Erro: ID do pedido inválido');
        setIsConfirmingPayment(false);
        return;
      }

      // Validar que tem um valor
      const totalAmount = parseFloat(String(localOrder.total));
      if (isNaN(totalAmount) || totalAmount <= 0) {
        console.error('[ADMIN] ❌ Valor inválido:', localOrder.total);
        toast.error('Erro: Valor do pedido inválido');
        setIsConfirmingPayment(false);
        return;
      }

      // 🔑 LOG: Informar a regra de pontos
      const rule = (localOrder.pointsRedeemed || 0) > 0 
        ? 'Cliente USOU pontos - NÃO ganhará novos pontos'
        : 'Cliente NÃO usou pontos - GANHARÁ novos pontos';
      
      console.log('[ADMIN] 💰 REGRA DE PONTOS:', rule, {
        pointsRedeemed: localOrder.pointsRedeemed,
        total: localOrder.total
      });

      console.log('[ADMIN] ✅ Validações passaram, chamando Edge Function com email:', localOrder.customer?.email);

      const { data, error } = await supabase.functions.invoke('confirm-payment-and-add-points', {
        body: {
          orderId: localOrder.id,
          customerId: undefined,
          amount: totalAmount,
          pointsRedeemed: localOrder.pointsRedeemed || 0,
        },
      });

      if (error) {
        console.error('[ADMIN] ❌ Erro da Edge Function:', {
          message: error.message,
          status: error.status,
          fullError: error
        });
        
        // Try to extract detailed error from response
        let errorDetail = error.message || 'Erro desconhecido';
        if (error.message?.includes('orderId')) {
          errorDetail = 'ID do pedido não encontrado';
        } else if (error.message?.includes('amount')) {
          errorDetail = 'Valor do pedido não foi especificado';
        } else if (error.message?.includes('cliente')) {
          errorDetail = 'Cliente não encontrado. Verifique se o email foi salvo.';
        }
        
        toast.error(`Erro ao confirmar: ${errorDetail}`);
        
        setIsConfirmingPayment(false);
        return;
      }

      if (!data) {
        console.error('[ADMIN] ❌ Nenhuma resposta da Edge Function');
        toast.error('Erro: Nenhuma resposta do servidor');
        setIsConfirmingPayment(false);
        return;
      }

      if (!data.success) {
        console.error('[ADMIN] ❌ Edge Function retornou success: false', data);
        toast.error(`Erro ao confirmar: ${data.error || 'Tente novamente'}`);
        setIsConfirmingPayment(false);
        return;
      }

      console.log('[ADMIN] ✅ Pagamento confirmado com sucesso:', data);

      // Atualizar status do pedido no store
      await updateOrderStatus(order.id, 'confirmed');
      
      // 💰 Para Cartão e Dinheiro: Pontos processados pelo Edge Function
      if (order.paymentMethod === 'card' || order.paymentMethod === 'cash') {
        const pointsRedeemed = order.pointsRedeemed || 0;
        const rule = pointsRedeemed > 0 
          ? 'Cliente USOU pontos - NÃO ganha novos'
          : 'Cliente NÃO usou pontos - GANHA novos';
        console.log(`[ADMIN] 💰 Pontos processados via Edge Function (${order.paymentMethod}):`, rule);
      }
      
      toast.success(data?.message || 'Pagamento confirmado e pontos adicionados!');
      onOpenChange(false);
      
    } catch (error) {
      console.error('[ADMIN] ❌ Erro ao confirmar pagamento:', {
        message: error instanceof Error ? error.message : String(error),
        error: error
      });
      toast.error(`Erro ao confirmar pagamento: ${error instanceof Error ? error.message : 'Tente novamente'}`);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Pedido {localOrder.id}
            <Badge variant="default" className={`${statusColors[localOrder.status]} text-white`}>
              {statusLabels[localOrder.status]}
            </Badge>
            {localOrder.autoConfirmedByPix && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                🤖 Auto-confirmado por PIX
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Change */}
          <div className="space-y-2">
            <Label>Alterar Status</Label>
            <Select value={localOrder.status} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Confirm Payment Button - For Cash and Card payments (except cancelled orders) */}
          {localOrder.status !== 'cancelled' && localOrder.paymentMethod !== 'pix' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-yellow-900">Confirmar Pagamento</p>
                <p className="text-yellow-800 text-xs mt-1">
                  Clique abaixo para confirmar o pagamento e adicionar pontos de lealdade ao cliente.
                </p>
              </div>
              <Button
                onClick={handleConfirmPayment}
                disabled={isConfirmingPayment}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isConfirmingPayment ? 'Confirmando...' : 'Confirmar Pagamento'}
              </Button>
            </div>
          )}

          <Separator />

          {/* Customer Info */}
          <div>
            <h4 className="font-semibold mb-3">Dados do Cliente</h4>
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground">Nome:</span> {localOrder.customer.name}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-muted-foreground">Telefone:</span> {localOrder.customer.phone}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-9 h-9 p-0 text-green-500 hover:bg-green-500/10 hover:text-green-600 flex-shrink-0"
                  onClick={() => window.open(formatWhatsAppUrl(localOrder.customer.phone), '_blank')}
                  title="Abrir WhatsApp com o cliente"
                >
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Info */}
          <div>
            <h4 className="font-semibold mb-2">
              {localOrder.deliveryType === 'delivery' ? 'Endereco de Entrega' : 'Retirada no Local'}
            </h4>
            {localOrder.deliveryType === 'delivery' ? (
              <div className="text-sm space-y-1">
                <p>
                  {localOrder.address.street}, {localOrder.address.number}
                  {localOrder.address.complement && ` - ${localOrder.address.complement}`}
                </p>
                <p>
                  {localOrder.address.neighborhood} - {localOrder.address.city}
                </p>
                {localOrder.address.reference && (
                  <p className="text-muted-foreground">
                    Referencia: {localOrder.address.reference}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cliente ira retirar o pedido no estabelecimento
              </p>
            )}
          </div>

          <Separator />

          {/* Scheduling Info - Se pedido foi agendado */}
          {localOrder.isScheduled && localOrder.scheduledFor && (
            <>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  📅 Entrega/Retirada Agendada
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground text-sm">Data e Hora:</span>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {format(new Date(localOrder.scheduledFor), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Items */}
          <div>
            <h4 className="font-semibold mb-4 text-base">Itens do Pedido</h4>
            <div className="space-y-4">
              {(localOrder.items ?? []).map((item, index) => {
                if (!item || !item.product) return null;
                
                // Converter item para o formato esperado pelo componente
                const itemProps = {
                  productName: item.product?.name || 'Produto desconhecido',
                  quantity: item.quantity || 1,
                  size: item.size || 'grande',
                  totalPrice: item.totalPrice,
                  itemData: item.itemData || null,
                };
                
                return (
                  <OrderItemDetails
                    key={index}
                    {...itemProps}
                    format="dashboard"
                  />
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(localOrder.subtotal)}</span>
            </div>
            {localOrder.deliveryType === 'delivery' && (
              <div className="flex justify-between text-sm">
                <span>Taxa de Entrega</span>
                <span>{formatPrice(localOrder.deliveryFee)}</span>
              </div>
            )}
            {localOrder.pointsDiscount && localOrder.pointsDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Desconto (Pontos Lealdade: {localOrder.pointsRedeemed})</span>
                <span>-{formatPrice(localOrder.pointsDiscount)}</span>
              </div>
            )}
            {localOrder.appliedCoupon && localOrder.couponDiscount && localOrder.couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-purple-600 font-medium">
                <span>Desconto (Cupom {localOrder.appliedCoupon})</span>
                <span>-{formatPrice(localOrder.couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(localOrder.total)}</span>
            </div>
          </div>

          <Separator />

          {/* Payment & Date */}
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              <Badge variant="outline">
                {localOrder.paymentMethod === 'pix' ? 'PIX' : localOrder.paymentMethod === 'card' ? 'Cartao' : 'Dinheiro'}
              </Badge>
            </div>
            {/* 🔍 DEBUG: Mostrar change_amount se existir */}
            {localOrder.address?.change_amount ? (
              <div>
                <span className="text-muted-foreground">Troco para:</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                  R$ {typeof localOrder.address.change_amount === 'number' 
                    ? localOrder.address.change_amount.toFixed(2)
                    : Number(localOrder.address.change_amount).toFixed(2)}
                </Badge>
              </div>
            ) : (
              <div className="text-muted-foreground text-xs">
                {localOrder.paymentMethod === 'cash' ? 'Sem troco' : ''}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Data:</span>
              {format(new Date(localOrder.createdAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
            </div>
          </div>

          {localOrder.observations && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Observacoes</h4>
                <p className="text-sm text-muted-foreground">{localOrder.observations}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
