import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Order } from '@/data/products';
import { supabase } from '@/integrations/supabase/client';

type OrderStatus = 'pending' | 'agendado' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

// Helper para obter hora local em formato ISO string sem timezone
const getLocalISOString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;
};

// Helper para gerar IDs únicos para order_items (usando timestamp + random pequeno)
const generateItemId = (): number => {
  // Gerar um número único e pequeno o bastante para bigint
  // Formato: timestamp em ms + número aleatório (garante unicidade e está dentro dos limites de bigint)
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
};

interface OrdersStore {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>, autoprint?: boolean) => Promise<Order>;
  addOrderToStoreOnly: (orderData: Order) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateOrderPrintedAt: (id: string, printedAt: string) => Promise<void>;
  updateOrderPointsRedeemed: (id: string, pointsRedeemed: number) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
  getOrdersByDateRange: (startDate: Date, endDate: Date) => Order[];
  syncOrdersFromSupabase: () => Promise<void>;
  getStats: (startDate: Date, endDate: Date) => {
    totalOrders: number;
    totalRevenue: number;
    avgTicket: number;
    deliveredOrders: number;
    cancelledOrders: number;
  };
}

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      orders: [],

      addOrder: async (orderData, autoprint = false) => {
        const newOrder: Order = {
          ...orderData,
          id: `PED-${String(Date.now()).slice(-6)}`,
          createdAt: new Date(),
        };

        try {
          // 🔧 CRÍTICO: Usar hora do cliente (JavaScript hora local)
          // Enviar como ISO com timezone para Supabase converter corretamente
          const nowDate = new Date(); // Hora local do cliente
          const createdAtISO = nowDate.toISOString(); // Formato: 2026-03-11T15:41:00.000Z
          
          console.log('⏰ [TIMESTAMP] Hora do cliente:', {
            navegador: nowDate.toLocaleString('pt-BR'),
            iso: createdAtISO,
          });
          
          // ✅ CRÍTICO: Garantir tenant_id sempre valid ou usar padrão
          let finalTenantId = newOrder.tenantId;
          if (!finalTenantId) {
            console.warn('⚠️ [ADDORDER] tenant_id não fornecido, buscando padrão...');
            const { data: tenants } = await (supabase as any)
              .from('tenants')
              .select('id')
              .limit(1);
            if (tenants?.length > 0) {
              finalTenantId = tenants[0].id;
              console.log('📍 [ADDORDER] Usando tenant padrão:', finalTenantId);
            } else {
              console.error('❌ [ADDORDER] Nenhum tenant encontrado no banco!');
            }
          } else {
            console.log('📍 [ADDORDER] Usando tenant fornecido:', finalTenantId);
          }
          
          // 🔍 LOG: Verificar dados do cliente
          console.log('📦 [ADDORDER] Criando pedido com dados:', {
            id: newOrder.id,
            customerName: newOrder.customer.name,
            customerPhone: newOrder.customer.phone,
            customerEmail: newOrder.customer.email,
            total: newOrder.total,
            pointsRedeemed: newOrder.pointsRedeemed,
            status: newOrder.status,
            tenantId: finalTenantId,
          });

          // Validar que email não é vazio
          const customerEmail = (newOrder.customer.email || '').trim();
          if (!customerEmail) {
            console.error('❌ [ADDORDER] ERRO: Email do cliente é obrigatório!');
            throw new Error('Email do cliente é obrigatório para criar pedido');
          }
          
          // Store payment_method as metadata in address JSONB
          const addressWithMetadata = {
            ...newOrder.address,
            paymentMethod: newOrder.paymentMethod, // Store internally for later retrieval
          };
          
          // 🔑 CRÍTICO: Calcular pending_points baseado em se cliente usou pontos
          // Se cliente resgatou pontos: NÃO ganhou novos pontos nesta compra
          // Se cliente NÃO resgatou pontos: Ganha pontos normalmente (1 real = 1 ponto)
          const pointsRedeemed = newOrder.pointsRedeemed || 0;
          const pendingPoints = pointsRedeemed > 0 ? 0 : Math.round(newOrder.total);
          
          console.log('💰 [ADDORDER] Cálculo de pontos:', {
            pointsRedeemed,
            total: newOrder.total,
            pendingPoints,
            rule: pointsRedeemed > 0 ? 'Cliente usou pontos - NÃO ganha novos' : 'Cliente não usou pontos - Ganha novos'
          });
          
          // 📋 Preparar scheduled_for - Converter para ISO se for Date
          let scheduledForValue: string | null = null;
          if (newOrder.scheduledFor) {
            if (typeof newOrder.scheduledFor === 'string') {
              scheduledForValue = newOrder.scheduledFor;
            } else if (newOrder.scheduledFor instanceof Date) {
              scheduledForValue = newOrder.scheduledFor.toISOString();
            }
          }
          
          // 🔧 CRÍTICO: Normalizar timestamp para formato exato YYYY-MM-DDTHH:MM:SS
          if (scheduledForValue && scheduledForValue.includes('T')) {
            const [datePart, timePart] = scheduledForValue.split('T');
            // Pegar apenas os primeiros 8 caracteres do time: HH:MM:SS
            const cleanTime = timePart.substring(0, 8);
            scheduledForValue = `${datePart}T${cleanTime}`;
            console.log('🔧 [TIMESTAMP] Normalizado:', { input: newOrder.scheduledFor, output: scheduledForValue });
          }
          
          // 🆕 Se pedido é agendado, usar status "agendado" em vez de "pending"
          const statusToUse = (newOrder.isScheduled && scheduledForValue) ? 'agendado' : newOrder.status;
          
          // 🔒 VALIDAÇÃO SERVIDOR: Se agendado, verificar se data está dentro do limite permitido
          if (newOrder.isScheduled && scheduledForValue) {
            const scheduledDate = scheduledForValue.split('T')[0]; // 'YYYY-MM-DD'
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDateObj = new Date(`${scheduledDate}T00:00`);
            const daysDifference = Math.floor((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // Buscar maxScheduleDays da configuração do tenant
            const { data: settingsData } = await (supabase as any)
              .from('settings')
              .select('max_schedule_days')
              .eq('id', 'store-settings')
              .single();
            
            const maxScheduleDays = settingsData?.max_schedule_days ?? 7;
            
            if (daysDifference > maxScheduleDays) {
              console.error('🚨 [SECURITY] Tentativa de agendar além do limite:', {
                orderId: newOrder.id,
                scheduledDate,
                daysDifference,
                maxScheduleDays
              });
              throw new Error(`❌ Data inválida! Você só pode agendar com até ${maxScheduleDays} dia${maxScheduleDays !== 1 ? 's' : ''} de antecedência`);
            }
          }
          
          console.log('📋 [PRE-INSERT] Enviando para Supabase:', {
            id: newOrder.id,
            customer_name: newOrder.customer.name,
            customer_phone: newOrder.customer.phone,
            email: customerEmail,
            delivery_fee: newOrder.deliveryFee,
            status: statusToUse,
            total: newOrder.total,
            points_discount: newOrder.pointsDiscount || 0,
            points_redeemed: pointsRedeemed,
            pending_points: pendingPoints,
            payment_method: newOrder.paymentMethod,
            is_scheduled: newOrder.isScheduled || false,
            scheduled_for: scheduledForValue,
            created_at: createdAtISO,
            address: addressWithMetadata,
            tenant_id: finalTenantId,
          });
          
          const { error } = await supabase.from('orders').insert([
            {
              id: newOrder.id,
              customer_name: newOrder.customer.name,
              customer_phone: newOrder.customer.phone,
              email: customerEmail,
              delivery_fee: newOrder.deliveryFee,
              status: statusToUse,
              total: newOrder.total,
              points_discount: newOrder.pointsDiscount || 0,
              points_redeemed: pointsRedeemed,
              pending_points: pendingPoints,
              payment_method: newOrder.paymentMethod,
              is_scheduled: newOrder.isScheduled || false,
              scheduled_for: scheduledForValue,
              created_at: createdAtISO,
              address: addressWithMetadata,
              tenant_id: finalTenantId,
            },
          ] as any);

          if (error) {
            console.error('❌ Erro ao inserir order:', error);
            console.error('❌ Erro detalhes:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            });
            throw error;
          }
          console.log('✅ Order inserida com sucesso:', newOrder.id, 'em', createdAtISO, 'com email:', customerEmail, 'pending_points:', pendingPoints, 'tenant_id:', finalTenantId);

          // 🔀 NOVA INTEGRAÇÃO: Incrementar current_orders do slot se pedido está agendado
          if (newOrder.isScheduled && scheduledForValue && finalTenantId) {
            try {
              const scheduledDate = scheduledForValue.split('T')[0]; // 'YYYY-MM-DD'
              const scheduledTime = scheduledForValue.split('T')[1]?.substring(0, 5); // 'HH:MM'
              
              console.log('🔄 Incrementando contador do slot:', {
                orderId: newOrder.id,
                tenantId: finalTenantId,
                slotDate: scheduledDate,
                slotTime: scheduledTime,
              });

              // ✅ CORRIGIDO: Atualizar current_orders diretamente (sem Edge Function - CORS issue)
              const { data: slot, error: slotError } = await (supabase as any)
                .from('scheduling_slots')
                .select('id, current_orders, max_orders')
                .eq('tenant_id', finalTenantId)
                .eq('slot_date', scheduledDate)
                .eq('slot_time', scheduledTime)
                .maybeSingle();

              if (slotError) {
                console.warn('⚠️ Erro ao buscar slot:', slotError);
              } else if (slot) {
                const newOrderCount = slot.current_orders + 1;
                
                // Verificar se não vai exceder kapacidade
                if (newOrderCount <= slot.max_orders) {
                  const { error: updateError } = await (supabase as any)
                    .from('scheduling_slots')
                    .update({ current_orders: newOrderCount })
                    .eq('id', slot.id);

                  if (updateError) {
                    console.warn('⚠️ Erro ao atualizar current_orders:', updateError);
                  } else {
                    console.log('✅ Slot reservado: current_orders incrementado para', newOrderCount);
                  }
                } else {
                  console.warn('⚠️ Slot chegou ao limite de pedidos');
                }
              }
            } catch (err) {
              console.error('❌ Erro ao atualizar slot:', err);
              // Não bloquear criação do pedido se atualização falhar
            }
          }

          // Salvar itens do pedido com TODOS os dados inclusos
          // 🎯 CRÍTICO: Gerar ID para cada item (campo obrigatório na BD)
          console.log('📦 [ITEMS] Preparando para salvar', newOrder.items?.length || 0, 'items...');

          const orderItems = (newOrder.items || []).map((item) => {
            // ✅ IMPORTANTE: Incluir TODOS os dados do item no item_data JSONB
            const itemDataObj = {
              // Informações da pizza
              pizzaType: item.isHalfHalf ? 'meia-meia' : 'inteira',
              sabor1: item.product?.name || 'Sem sabor',
              sabor2: item.isHalfHalf && item.secondHalf ? item.secondHalf.name : null,
              
              // Customizações
              customIngredients: Array.isArray(item.customIngredients) ? item.customIngredients : [],
              paidIngredients: Array.isArray(item.paidIngredients) ? item.paidIngredients : [],
              extras: Array.isArray(item.extras) ? item.extras.map((e: any) => typeof e === 'string' ? e : e.name || e) : [],
              
              // Acompanhamentos
              drink: item.drink ? (typeof item.drink === 'string' ? item.drink : item.drink.name) : null,
              border: item.border ? (typeof item.border === 'string' ? item.border : item.border.name) : null,
              
              // Combos
              comboPizzas: Array.isArray(item.comboPizzasData) ? item.comboPizzasData : [],
              
              // Observações
              notes: newOrder.observations || null,
            };
            
            // ✅ CRUCIAL: Gerar ID único para cada item (necessário para bigint pk)
            const itemId = generateItemId();
            
            // 🔧 CORRIGIDO: Mapear para campos EXATOS da tabela order_items conforme schema
            // Schema: id, order_id, product_id, product_name, quantity, size, total_price, item_data (jsonb), created_at
            const itemRecord = {
              id: itemId, // 🎯 ID obrigatório bigint
              order_id: newOrder.id,
              product_id: item.product?.id || 'unknown',
              product_name: item.product?.name || 'Produto desconhecido',
              quantity: item.quantity || 1,
              size: item.size || 'grande',
              total_price: item.totalPrice || 0,
              item_data: itemDataObj, // ✅ JSONB com TODOS os dados do item (sem JSON.stringify - Supabase cuida)
              created_at: createdAtISO, // Usar timestamp do pedido
            };
            
            console.log(`✅ [ITEM-${itemId}] "${itemRecord.product_name}" (qty: ${item.quantity}, total: ${itemRecord.total_price}) -> inserindo na BD...`);
            
            return itemRecord;
          });

          if (orderItems.length > 0) {
            console.log(`💾 [SAVEORDER] Tentando inserir ${orderItems.length} items na tabela order_items...`);
            
            const { error: itemsError, data: itemsData } = await supabase
              .from('order_items')
              .insert(orderItems as any);
              
            if (itemsError) {
              console.error('❌ ERRO ao inserir order_items:', {
                message: itemsError.message,
                code: itemsError.code,
                details: itemsError.details,
                hint: itemsError.hint,
              });
              // Não bloquear criação do pedido se items falharem
            } else {
              console.log(`✅ SUCESSO! ${orderItems.length} items foram inseridos na BD:`, 
                orderItems.map(item => `${item.id}(${item.product_name})`).join(', ')
              );
            }
          } else {
            console.warn('⚠️ AVISO: Nenhum item para salvar! Items array vazio');
          }

          // Tentar imprimir pedido automaticamente via Edge Function com RETRY (apenas se autoprint = true)
          if (autoprint) {
            console.log('🖨️ Auto-print HABILITADO. Iniciando impressão para:', newOrder.id);
            
            const invokePrintWithRetry = async () => {
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  console.log(`Tentativa ${attempt}/5 de invocar printorder...`);
                  const { data, error } = await supabase.functions.invoke('printorder', {
                    body: { orderId: newOrder.id },
                  });

                  if (error) {
                    console.error(`Tentativa ${attempt}: Erro -`, error.message || error);
                    if (attempt < 5) {
                      await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                      continue;
                    }
                    throw error;
                  }

                  console.log(`Printorder sucesso na tentativa ${attempt}`);
                  
                  // Se printorder funcionou, marcar como impresso com hora local
                  const printedAtLocal = getLocalISOString();
                  
                  const { error: updateError } = await (supabase as any)
                    .from('orders')
                    .update({ printed_at: printedAtLocal })
                    .eq('id', newOrder.id);
                    
                  if (!updateError) {
                    console.log('Status de impressão atualizado');
                  }
                  return;
                } catch (err) {
                  console.error(`Tentativa ${attempt} falhou:`, err);
                  if (attempt === 5) {
                    console.error('Falha: não foi possível invocar printorder após 5 tentativas');
                  }
                }
              }
            };

            // Invocar assincronamente (não bloqueia)
            invokePrintWithRetry();
          } else {
            console.log('Auto-print desabilitado para este pagamento');
          }
        } catch (error) {
          console.error('Erro ao salvar pedido no Supabase:', error);
        }

        // Salvar localmente também
        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        return newOrder;
      },

      addOrderToStoreOnly: (orderData) => {
        // Apenas adicionar à store local, sem persistir no BD
        // Usado para sincronização realtime onde o pedido já foi salvo no BD
        const newOrder: Order = {
          ...orderData,
          createdAt: orderData.createdAt instanceof Date ? orderData.createdAt : new Date(orderData.createdAt),
        };
        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));
        return newOrder;
      },

      updateOrderStatus: async (id, status) => {
        try {
          console.log(`
╔═══════════════════════════════════════╗
║  UPDATE ORDER STATUS                  ║
╠═══════════════════════════════════════╣
║  Pedido:  ${id}
║  Status:  ${status}
╚═══════════════════════════════════════╝
`);
          
          // Buscar order completo para enviar notificação e reversão de pontos
          const { data: orderData } = await (supabase as any).from('orders')
            .select('id, customer_name, email, tenant_id, customer_phone, customer_id, pending_points, points_redeemed, address, is_scheduled, scheduled_for')
            .eq('id', id)
            .single();

          console.log(`📦 Order data:`, orderData);

          // 🔄 SE CANCELANDO PEDIDO AGENDADO: Liberar vaga no slot
          if (status === 'cancelled' && orderData?.is_scheduled && orderData?.scheduled_for && orderData?.tenant_id) {
            try {
              const scheduledDate = orderData.scheduled_for.split('T')[0]; // 'YYYY-MM-DD'
              const scheduledTime = orderData.scheduled_for.split('T')[1]?.substring(0, 5); // 'HH:MM'

              console.log('🔄 Liberando slot do pedido agendado:', {
                orderId: id,
                tenantId: orderData.tenant_id,
                slotDate: scheduledDate,
                slotTime: scheduledTime,
              });

              // Buscar slot e decrementar current_orders
              const { data: slot, error: slotError } = await (supabase as any)
                .from('scheduling_slots')
                .select('id, current_orders')
                .eq('tenant_id', orderData.tenant_id)
                .eq('slot_date', scheduledDate)
                .eq('slot_time', scheduledTime)
                .maybeSingle();

              if (slotError) {
                console.warn('⚠️ Erro ao buscar slot:', slotError);
              } else if (slot && slot.current_orders > 0) {
                const { error: updateError } = await (supabase as any)
                  .from('scheduling_slots')
                  .update({ current_orders: slot.current_orders - 1 })
                  .eq('id', slot.id);

                if (updateError) {
                  console.warn('⚠️ Erro ao liberar slot:', updateError);
                } else {
                  console.log('✅ Slot liberado com sucesso');
                }
              }
            } catch (err) {
              console.error('❌ Erro ao liberar slot:', err);
              // Não bloquear cancelamento se liberação falhar
            }
          }

          // Atualizar no Supabase
          const { error } = await supabase.from('orders')
            .update({ status })
            .eq('id', id);

          if (error) throw error;
          console.log(`✅ Status atualizado no banco: ${status}`);

          // � CRÍTICO: Se cancelado, os pontos devem ser revertidos automaticamente via trigger
          if (status === 'cancelled') {
            console.log(`
💎 [REVERSÃO-PONTOS] Cancelamento detectado!
   Pedido: ${id}
   Cliente ID: ${orderData?.customer_id}
   Pontos Pendentes: ${orderData?.pending_points}
   Pontos Resgatados: ${orderData?.points_redeemed}
   ⚠️ Trigger no banco irá reverter automaticamente
`);
          }

          // �📱 CRÍTICO: Enviar notificação WhatsApp (fire-and-forget com logs)
          if (orderData?.customer_phone && orderData?.tenant_id) {
            console.log(`
🔔 [DISPARO-NOTIFICAÇÃO] Iniciando envio...
   Pedido: ${id}
   Status: ${status}
   Telefone: ${orderData.customer_phone}
   Tenant: ${orderData.tenant_id}
   Cliente: ${orderData.customer_name || 'Desconhecido'}
`);
            
            // Não aguarda pois é assíncrono, mas faz log de sucesso/erro
            supabase.functions.invoke('send-whatsapp-notification', {
              body: {
                orderId: id,
                status: status,
                phone: orderData.customer_phone,
                customerName: orderData.customer_name || 'Cliente',
                tenantId: orderData.tenant_id,
              },
            })
              .then((response) => {
                console.log(`✅ [WHATSAPP] Notificação disparada com sucesso:`, response.data);
              })
              .catch((err) => {
                console.error(`❌ [WHATSAPP] Erro ao enviar notificação:`, err);
              });
          } else {
            console.warn(`⚠️ [WHATSAPP] Sem telefone ou tenant_id:`);
            console.warn(`   - phone: ${orderData?.customer_phone}`);
            console.warn(`   - tenant_id: ${orderData?.tenant_id}`);
          }
        } catch (error) {
          console.error('❌ Erro ao atualizar status no Supabase:', error);
        }

        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, status } : order
          ),
        }));
      },

      updateOrderPrintedAt: async (id, printedAt) => {
        try {
          // Atualizar no Supabase
          const { error } = await (supabase as any).from('orders')
            .update({ printed_at: printedAt })
            .eq('id', id);

          if (error) throw error;
        } catch (error) {
          console.error('Erro ao atualizar printed_at no Supabase:', error);
        }

        // Atualizar localmente IMEDIATAMENTE
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, printedAt } : order
          ),
        }));
      },

      updateOrderPointsRedeemed: async (id, pointsRedeemed) => {
        try {
          // 🔒 CRÍTICO: Atualizar points_redeemed no Supabase IMEDIATAMENTE
          // Isso registra que esses pontos foram "reservados" para esta compra
          const { error } = await (supabase as any).from('orders')
            .update({ 
              points_redeemed: pointsRedeemed,
              points_discount: pointsRedeemed // Atualizar desconto também
            })
            .eq('id', id);

          if (error) {
            console.error('❌ Erro ao atualizar points_redeemed:', error);
            throw error;
          }

          console.log(`✅ Points redeemed registrados: ${pointsRedeemed} pontos para ordem ${id}`);
        } catch (error) {
          console.error('Erro ao atualizar points_redeemed no Supabase:', error);
        }

        // Atualizar store localmente
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id 
              ? { 
                  ...order, 
                  pointsRedeemed,
                  pointsDiscount: pointsRedeemed 
                } 
              : order
          ),
        }));
      },

      removeOrder: async (id) => {
        try {
          // Deletar do Supabase
          await supabase.from('order_items').delete().eq('order_id', id);
          const { error } = await supabase.from('orders').delete().eq('id', id);

          if (error) throw error;
        } catch (error) {
          console.error('Erro ao deletar pedido do Supabase:', error);
        }

        set((state) => ({
          orders: state.orders.filter((order) => order.id !== id),
        }));
      },

      getOrderById: (id) => get().orders.find((order) => order.id === id),

      getOrdersByDateRange: (startDate, endDate) => {
        const orders = get().orders;
        return orders.filter((order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });
      },

      syncOrdersFromSupabase: async () => {
        try {
          console.log('🔍 [SYNC] Iniciando sincronização de pedidos do Supabase...');
          const { data, error } = await supabase.from('orders')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ [SYNC] Erro ao carregar orders:', error);
            throw error;
          }

          if (data && data.length > 0) {
            console.log(`🔄 [SYNC] Sincronizando ${data.length} pedidos do Supabase`);
            
            // Buscar também os itens de cada pedido
            const ordersWithItems = await Promise.all(
              data.map(async (row: any) => {
                console.log(`📦 [SYNC] Carregando items para ${row.id}...`);
                const { data: items, error: itemsError } = await supabase.from('order_items')
                  .select('*')
                  .eq('order_id', row.id);
                  
                if (itemsError) {
                  console.warn(`⚠️ [SYNC] Erro ao carregar items para ${row.id}:`, itemsError);
                } else {
                  console.log(`✅ [SYNC] Carregados ${items?.length || 0} items para ${row.id}`);
                }

                // Parse createdAt - manter o ISO string original do banco
                // A conversão de horário já é feita implicitamente pelo JavaScript
                const createdAtDate = new Date(row.created_at);
                
                // Extrair payment_method da metadata do address
                const paymentMethodFromMetadata = (row.address as any)?.paymentMethod || 'pix';
                
                // Preparar address sem metadata interna
                const displayAddress = row.address ? {
                  city: row.address.city || '',
                  neighborhood: row.address.neighborhood || '',
                  street: row.address.street || '',
                  number: row.address.number || '',
                  complement: row.address.complement || '',
                  reference: row.address.reference || '',
                } : {
                  city: '',
                  neighborhood: '',
                  street: '',
                  number: '',
                  complement: '',
                  reference: '',
                };
                
                const syncedOrder: Order = {
                  id: row.id,
                  customer: {
                    name: row.customer_name,
                    phone: row.customer_phone,
                  },
                  address: displayAddress,
                  deliveryType: 'delivery' as const,
                  deliveryFee: row.delivery_fee,
                  paymentMethod: paymentMethodFromMetadata as any,
                  items: items?.map((item: any) => {
                    // 🔧 PARSER ROBUSTO: Extrair dados do item_data (JSONB do banco)
                    let itemData: any = {};
                    
                    try {
                      if (item.item_data) {
                        // item_data pode vir como string ou já como objeto (depende da BD)
                        if (typeof item.item_data === 'string') {
                          itemData = JSON.parse(item.item_data);
                        } else if (typeof item.item_data === 'object') {
                          itemData = item.item_data;
                        }
                      }
                    } catch (parseError) {
                      console.warn(`⚠️ [SYNC] Erro ao parsear item_data para ${item.product_name}:`, parseError);
                      itemData = {}; // Continuar com objeto vazio
                    }

                    // ✅ INTELIGENTE: Reconstruir item com TODOS os dados, com fallbacks
                    const reconstructedItem = {
                      id: item.id || `item-${Date.now()}`,
                      product: { 
                        id: item.product_id || 'unknown', 
                        name: item.product_name || 'Produto desconhecido' 
                      } as any,
                      quantity: Math.max(item.quantity || 1, 1),
                      size: item.size || 'grande',
                      totalPrice: Number(item.total_price) || 0,
                      
                      // Pizza info (meia-meia ou inteira)
                      isHalfHalf: itemData.pizzaType === 'meia-meia' ? true : false,
                      secondHalf: itemData.sabor2 ? { 
                        id: 'half-2',
                        name: String(itemData.sabor2) 
                      } as any : undefined,
                      
                      // Acompanhamentos
                      border: itemData.border ? { 
                        id: 'border',
                        name: String(itemData.border) 
                      } as any : undefined,
                      drink: itemData.drink ? { 
                        id: 'drink',
                        name: String(itemData.drink) 
                      } as any : undefined,
                      
                      // Extras
                      extras: Array.isArray(itemData.extras) 
                        ? itemData.extras
                            .filter((e: any) => e) // Remove nulos
                            .map((e: any) => ({
                              id: `extra-${String(e)}`,
                              name: String(e)
                            }))
                        : [],
                      
                      // Ingredientes customizados (agora como JSON string)
                      customIngredients: (() => {
                        try {
                          // Tentar parsear custom_ingredients como JSON string
                          if (item.custom_ingredients) {
                            if (typeof item.custom_ingredients === 'string') {
                              return JSON.parse(item.custom_ingredients);
                            }
                            return Array.isArray(item.custom_ingredients) ? item.custom_ingredients : [];
                          }
                          // Fallback para itemData (compatibilidade com dados antigos)
                          return Array.isArray(itemData.customIngredients)
                            ? itemData.customIngredients.filter((i: any) => i).map((i: any) => String(i))
                            : [];
                        } catch (e) {
                          return [];
                        }
                      })(),
                      
                      paidIngredients: (() => {
                        try {
                          // Tentar parsear paid_ingredients como JSON string
                          if (item.paid_ingredients) {
                            if (typeof item.paid_ingredients === 'string') {
                              return JSON.parse(item.paid_ingredients);
                            }
                            return Array.isArray(item.paid_ingredients) ? item.paid_ingredients : [];
                          }
                          // Fallback para itemData (compatibilidade com dados antigos)
                          return Array.isArray(itemData.paidIngredients)
                            ? itemData.paidIngredients.filter((i: any) => i).map((i: any) => String(i))
                            : [];
                        } catch (e) {
                          return [];
                        }
                      })(),
                      
                      // Combos
                      comboPizzasData: Array.isArray(itemData.comboPizzas) 
                        ? itemData.comboPizzas 
                        : [],
                      
                      // Observações
                      notes: itemData.notes || undefined,
                    };
                    
                    console.log(`✅ [SYNC-ITEM] "${item.product_name}" reconstruído com sucesso:`, {
                      quantity: reconstructedItem.quantity,
                      size: reconstructedItem.size,
                      isHalfHalf: reconstructedItem.isHalfHalf,
                      hasExtras: reconstructedItem.extras.length,
                      drinkName: reconstructedItem.drink?.name,
                      borderName: reconstructedItem.border?.name,
                    });
                    
                    return reconstructedItem;
                  }) || [],
                  subtotal: row.total,
                  total: row.total,
                  pointsDiscount: row.points_discount || 0,
                  pointsRedeemed: row.points_redeemed || 0,
                  status: row.status as any,
                  observations: '',
                  createdAt: createdAtDate,
                  // ✅ Sincronizar printed_at: só setá se realmente houver um valor (não null, não vazio)
                  printedAt: row.printed_at && row.printed_at !== null && row.printed_at !== '' 
                    ? new Date(row.printed_at).toISOString() 
                    : undefined,
                  // 🤖 Indicador de auto-confirmação via PIX
                  autoConfirmedByPix: row.auto_confirmed_by_pix === true,
                  // 📅 NOVO: Agendamento de pedido
                  isScheduled: row.is_scheduled === true,
                  scheduledFor: row.scheduled_for ? row.scheduled_for : undefined,
                };
                
                return syncedOrder;
              })
            );

            set(() => ({
              orders: ordersWithItems as Order[],
            }));
            
            // 📊 Log final bastante detalhado
            const totalItems = ordersWithItems.reduce((sum, order) => sum + (order.items?.length || 0), 0);
            console.log(`✅ [SYNC] SINCRONIZAÇÃO COMPLETA: ${ordersWithItems.length} pedidos, ${totalItems} items`);
            ordersWithItems.slice(0, 3).forEach(o => {
              console.log(`   📦 ${o.id}: ${o.items?.length || 0} items`);
            });
          } else {
            console.warn('⚠️ [SYNC] Nenhum pedido retornado do banco');
          }
        } catch (error) {
          console.error('❌ [SYNC] Erro ao sincronizar pedidos do Supabase:', error);
        }
      },

      getStats: (startDate, endDate) => {
        const filteredOrders = get().getOrdersByDateRange(startDate, endDate);
        const completedOrders = filteredOrders.filter(
          (o) => o.status !== 'cancelled' && o.status !== 'pending'
        );
        const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
        
        return {
          totalOrders: filteredOrders.length,
          totalRevenue,
          avgTicket: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
          deliveredOrders: filteredOrders.filter((o) => o.status === 'delivered').length,
          cancelledOrders: filteredOrders.filter((o) => o.status === 'cancelled').length,
        };
      },
    }),
    {
      name: 'forneiro-eden-orders',
      version: 1,
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Convert date strings back to Date objects
          if (parsed.state?.orders) {
            parsed.state.orders = parsed.state.orders.map((order: any) => ({
              ...order,
              createdAt: new Date(order.createdAt),
            }));
          }
          return parsed;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
