import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// VALIDATE WEBHOOK SIGNATURE (Per-Tenant - 100% Multi-tenant)
// ============================================================
async function validateWebhookSignature(
  supabase: any,
  tenantId: string,
  body: string,
  signature: string
): Promise<boolean> {
  try {
    // Buscar webhook_secret específico do tenant na coluna
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('webhook_secret')
      .eq('id', tenantId)
      .single();

    if (error || !tenant?.webhook_secret) {
      console.warn(`⚠️ [WEBHOOK] Tenant ${tenantId} não tem webhook_secret configurado, pulando validação`);
      return true; // Allow if tenant has no secret configured (tolerance mode)
    }

    const webhookSecret = tenant.webhook_secret;
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(body + webhookSecret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const isValid = computedSignature === signature;
      if (isValid) {
        console.log(`✅ [WEBHOOK] Validação de assinatura OK para tenant ${tenantId}`);
      } else {
        console.warn(`⚠️ [WEBHOOK] Assinatura inválida para tenant ${tenantId}`);
      }
      return isValid;
    } catch (error) {
      console.error('❌ [WEBHOOK] Erro ao validar assinatura:', error);
      return false;
    }
  } catch (error) {
    console.warn(`⚠️ [WEBHOOK] Erro ao buscar webhook_secret do tenant ${tenantId}:`, error);
    return true; // Tolerance mode: permitem webhook continuar
  }
}

// Obter token de acesso (tenant ou fallback do sistema)
async function getAccessToken(supabase: any, tenantId?: string): Promise<string> {
  const fallbackToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

  // ✅ MULTI-TENANT FIX: Se tenantId fornecido, buscar token específico do tenant
  if (tenantId) {
    try {
      const { data } = await supabase
        .from('tenants')
        .select('id, mercadopago_access_token')
        .eq('id', tenantId) // ✅ Filtrar por tenant_id específico
        .single();

      if (data?.mercadopago_access_token) {
        console.log(`✅ Usando token do tenant: ${tenantId}`);
        return data.mercadopago_access_token;
      }
    } catch (error) {
      console.warn(`⚠️ Tenant ${tenantId} não encontrado ou sem token:`, error);
    }
  }

  // Fallback: tentar buscar primeiro tenant (compatibilidade)
  try {
    const { data } = await supabase
      .from('tenants')
      .select('id, mercadopago_access_token')
      .limit(1)
      .single();

    if (data?.mercadopago_access_token) {
      console.log(`✅ Usando token do tenant (fallback): ${data.id}`);
      return data.mercadopago_access_token;
    }
  } catch (error) {
    console.warn('⚠️ Nenhum tenant encontrado ou sem token configurado:', error);
  }

  if (!fallbackToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN not configured');
  }

  console.log('⚠️ Usando token do sistema (fallback)');
  return fallbackToken;
}

// ============================================================
// HELPER: Gerar ID único para order_items (mesmo padrão do useOrdersStore)
// ============================================================
function generateItemId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// ============================================================
// HELPER: Invocar printorder com RETRY (padrão Cartão/Dinheiro)
// ============================================================
async function invokePrintorderWithRetry(
  supabaseUrl: string,
  supabaseKey: string,
  orderId: string,
  tenantId: string,
  paymentMethod?: string  // ⭐ Parâmetro opcional para PIX (evita race condition)
): Promise<boolean> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`🖨️ [PRINTORDER] Tentativa ${attempt}/5 para pedido ${orderId}...`);
      
      const body: any = {
        orderId: orderId,
        tenantId: tenantId,
      };
      
      // ⭐ Se payment_method foi fornecido (PIX), passa direto (prioridade)
      if (paymentMethod) {
        body.paymentMethod = paymentMethod;
        console.log(`📝 [PRINTORDER] Passando paymentMethod direto: ${paymentMethod}`);
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/printorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(`⚠️ [PRINTORDER] Tentativa ${attempt} retornou status ${response.status}`);
        if (attempt < 5) {
          const delayMs = 1000 * attempt;
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const responseData = await response.json();
      console.log(`✅ [PRINTORDER] Sucesso na tentativa ${attempt}:`, responseData);
      return true;
    } catch (err) {
      console.warn(`⚠️ [PRINTORDER] Tentativa ${attempt} falhou:`, err instanceof Error ? err.message : String(err));
      if (attempt === 5) {
        console.error(`❌ [PRINTORDER] Falha após 5 tentativas para ${orderId}`);
        return false;
      }
    }
  }
  return false;
}

// ============================================================
// FUNÇÃO AUXILIAR: NORMALIZAR PAYLOAD DO PEDIDO
// ============================================================
function normalizeOrderPayload(pendingOrder: any, paymentId: number, orderId: string): any {
  // Campos EXATOS que existem na tabela orders (baseado no schema real)
  const orderPayload = pendingOrder.order_payload || {};
  
  const result: any = {
    id: orderId,
    status: 'confirmed',
    payment_status: 'approved',
    payment_confirmed_at: new Date().toISOString(),
    mercado_pago_id: paymentId.toString(),
  };

  // ✅ CUSTOMER DATA - exatamente como está na tabela
  if (pendingOrder.customer_name) result.customer_name = pendingOrder.customer_name;
  if (pendingOrder.customer_phone) result.customer_phone = pendingOrder.customer_phone;
  if (pendingOrder.customer_email) result.email = pendingOrder.customer_email; // email, não customer_email!
  if (pendingOrder.customer_id) result.customer_id = pendingOrder.customer_id;

  // ✅ TOTALS - mapeamento correto de camelCase → snake_case
  if (orderPayload.totals) {
    // NOTA: não existe "subtotal" separado, apenas "total"
    if (orderPayload.totals.total !== undefined) result.total = orderPayload.totals.total;
    if (orderPayload.totals.deliveryFee !== undefined) result.delivery_fee = orderPayload.totals.deliveryFee;
    if (orderPayload.totals.pointsDiscount !== undefined) result.points_discount = orderPayload.totals.pointsDiscount;
    if (orderPayload.totals.pointsRedeemed !== undefined) result.points_redeemed = orderPayload.totals.pointsRedeemed;
    if (orderPayload.totals.couponDiscount !== undefined) result.coupon_discount = orderPayload.totals.couponDiscount;
    if (orderPayload.totals.appliedCoupon !== undefined) result.applied_coupon = orderPayload.totals.appliedCoupon;
  }

  // ✅ ADDRESS - MESMO PADRÃO DO useOrdersStore (Cartão/Dinheiro)
  // ADDRESS vem em delivery.address, não em orderPayload.address!
  if (orderPayload.delivery?.address) {
    const addressWithMetadata = {
      ...orderPayload.delivery.address,
      paymentMethod: orderPayload.payment?.method,
    };
    // Adicionar troco se cliente escolheu dinheiro com troco
    if (orderPayload.payment?.changeFor && orderPayload.payment.changeFor > 0) {
      addressWithMetadata.change_amount = orderPayload.payment.changeFor;
    }
    result.address = addressWithMetadata;
  }

  // ✅ PAYMENT & DELIVERY
  // ⭐ CRÍTICO: Garantir payment_method é SEMPRE 'pix' no webhook (mesmo que vazio)
  result.payment_method = orderPayload.paymentMethod || 'pix';
  if (orderPayload.deliveryType) result.delivery_type = orderPayload.deliveryType;
  if (orderPayload.scheduledFor) result.scheduled_for = orderPayload.scheduledFor;
  if (orderPayload.schedulingSlotId) result.scheduling_slot_id = orderPayload.schedulingSlotId;

  // ✅ AUTO-CONFIRM PIX
  result.auto_confirmed_by_pix = true;

  // ✅ TENANT_ID - usar do pending ou fallback do sistema
  if (!result.tenant_id) {
    result.tenant_id = pendingOrder.tenant_id || '550e8400-e29b-41d4-a716-446655440000';
  }

  // ⚠️ ITEMS & OBSERVATIONS
  // NÃO incluir aqui! "items" vão para a tabela separada "order_items"
  // "observations" devem ser salvos direto no order_payload ou em campo específico
  // Se o payload tiver, vamos simplificar: pegar do orderPayload.items como referência

  console.log(`📝 [WEBHOOK] Payload normalizado para insert:`, JSON.stringify({
    id: result.id,
    status: result.status,
    payment_status: result.payment_status,
    mercado_pago_id: result.mercado_pago_id,
    customer_name: result.customer_name,
    email: result.email,
    total: result.total,
    delivery_fee: result.delivery_fee,
    address: result.address ? 'jsonb object' : null,
    points_discount: result.points_discount,
    coupon_discount: result.coupon_discount,
    tenant_id: result.tenant_id
  }, null, 2));

  return result;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const body = await req.text();
    const signature = req.headers.get('x-signature') || '';
    
    // Parse payload to extract tenantId from external_reference
    const payloadData = JSON.parse(body);
    console.log('📨 Webhook received:', JSON.stringify(payloadData, null, 2));
    
    // Extract tenantId from external_reference (format: "tenantId|orderId")
    let tenantId = 'unknown';
    if (payloadData.data?.external_reference) {
      const [extractedTenantId] = payloadData.data.external_reference.split('|');
      tenantId = extractedTenantId;
    }
    
    console.log(`🔐 [WEBHOOK] Validando assinatura para tenant: ${tenantId}`);
    
    // 🔍 VALIDAÇÃO: Buscar secret do tenant no BD (100% multi-tenant)
    const isValid = await validateWebhookSignature(supabase, tenantId, body, signature);
    if (!isValid) {
      console.warn(`⚠️ [WEBHOOK] Assinatura INVÁLIDA para tenant ${tenantId} - continuando com tolerância`);
      console.warn(`⚠️ [WEBHOOK] Assinatura recebida: ${signature.substring(0, 20)}...`);
      console.warn('⚠️ [WEBHOOK] Possíveis causas: 1) Secret incorreto, 2) Payload alterado, 3) Ambiente desenvolvimento');
      // NOTE: Não retornamos 401 aqui - webhook continua processando (v8 compatibility)
    } else {
      console.log(`✅ [WEBHOOK] Assinatura validada para tenant ${tenantId}`);
    }

    // Handle payment notification
    if (payloadData.type === 'payment' && payloadData.data?.id) {
      const paymentId = payloadData.data.id;
      
      // Obter token de acesso (tenta do cliente, fallback para sistema)
      let accessToken;
      try {
        // ⚠️ Usar token genérico primeiro (não temos tenantId ainda)
        accessToken = await getAccessToken(supabase);
      } catch (error) {
        console.error('❌ Erro ao obter token de acesso:', error);
        return new Response(JSON.stringify({ error: 'No access token available' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get payment details from Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment details: ${paymentResponse.statusText}`);
      }

      const paymentData = await paymentResponse.json();
      console.log('💳 Payment data:', JSON.stringify(paymentData, null, 2));

      // ✅ MULTI-TENANT FIX: Parse external_reference para extrair tenantId e orderId
      const externalRef = paymentData.external_reference || '';
      const [tenantId, orderId] = externalRef.includes('|') 
        ? externalRef.split('|') 
        : ['', externalRef];
      
      if (!tenantId) {
        console.warn(`⚠️ [WEBHOOK] external_reference sem tenant_id: ${externalRef}`);
        return new Response(
          JSON.stringify({ error: 'Invalid external_reference format (missing tenant_id)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const status = paymentData.status;
      const mpStatus = paymentData.status;

      // 🔍 DEBUG: Validar orderId e tenantId
      console.log(`🔍 [WEBHOOK] Payload do Mercado Pago:`, JSON.stringify({
        paymentId: paymentData.id,
        status: paymentData.status,
        external_reference: paymentData.external_reference,
        tenantId,
        orderId,
        description: paymentData.description
      }, null, 2));

      // Map Mercado Pago status to our status
      const statusMap: Record<string, string> = {
        'approved': 'confirmed',
        'pending': 'pending',
        'in_process': 'processing',
        'rejected': 'rejected',
        'cancelled': 'cancelled',
        'refunded': 'refunded'
      };

      const mappedStatus = statusMap[status] || status;
      console.log(`📋 Order ${orderId} payment status: ${status} → ${mappedStatus}`);

      // ============================================================
      // ✅ SE PAGAMENTO APROVADO: Tentar criar pedido completo
      // ============================================================
      if (status === 'approved' && orderId) {
        try {
          // 1️⃣ Verificar se pedido já existe
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('tenant_id', tenantId) // ✅ MULTI-TENANT: Validar tenant_id
            .eq('id', orderId)
            .single();

          if (!existingOrder) {
            // 2️⃣ Tentar recuperar dados do pending_pix_order
            console.log(`🔍 Procurando dados do pedido em pending_pix_orders com tenant_id="${tenantId}" e id="${orderId}"...`);
            const { data: pendingOrder, error: pendingError } = await supabase
              .from('pending_pix_orders')
              .select('*')
              .eq('tenant_id', tenantId) // ✅ MULTI-TENANT: Validar tenant_id
              .eq('id', orderId)
              .single();

            console.log(`🔍 Resultado da busca em pending_pix_orders:`, {
              encontrado: !!pendingOrder,
              erro: pendingError?.message,
              pendingOrder: pendingOrder ? { id: pendingOrder.id, status: pendingOrder.status } : null
            });

            if (pendingOrder?.order_payload) {
              // 3️⃣ Criar ordem completa com dados do pending
              console.log(`✅ Dados encontrados! Criando pedido completo com payload:`, {
                orderId,
                customerName: pendingOrder.customer_name,
                customerEmail: pendingOrder.customer_email
              });
              
              // 🔄 NORMALIZAR PAYLOAD (remove campos inválidos, converte camelCase→snake_case)
              const normalizedOrderData = normalizeOrderPayload(pendingOrder, paymentId, orderId);
              
              const { error: createError } = await supabase
                .from('orders')
                .insert([normalizedOrderData]);

              if (createError) {
                console.error(`❌ Erro ao criar pedido ${orderId}:`, {
                  message: createError.message,
                  code: (createError as any).code,
                  details: (createError as any).details
                });
              } else {
                console.log(`✅ Pedido ${orderId} criado com sucesso pelo webhook!`);
                
                // ⭐ 4️⃣ SALVAR ITENS EM order_items (mesmo padrão do useOrdersStore para Cartão/Dinheiro)
                const orderPayload = pendingOrder.order_payload || {};
                if (orderPayload.items && Array.isArray(orderPayload.items) && orderPayload.items.length > 0) {
                  try {
                    // Usar getLocalISOString equivalente no Deno
                    const nowDate = new Date();
                    const year = nowDate.getFullYear();
                    const month = String(nowDate.getMonth() + 1).padStart(2, '0');
                    const date = String(nowDate.getDate()).padStart(2, '0');
                    const hours = String(nowDate.getHours()).padStart(2, '0');
                    const minutes = String(nowDate.getMinutes()).padStart(2, '0');
                    const seconds = String(nowDate.getSeconds()).padStart(2, '0');
                    const createdAtISO = `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;

                    const itemsToInsert = orderPayload.items.map((item: any) => {
                      // Montar item_data JSONB com TODOS os dados (mesmo padrão do useOrdersStore)
                      const itemDataObj = {
                        // Informações do item
                        itemType: item.isHalfHalf ? 'meia-meia' : 'inteira',
                        sabor1: item.product_name || 'Sem sabor',
                        sabor2: item.isHalfHalf && item.item_data?.sabor2 ? item.item_data.sabor2 : null,
                        
                        // Customizações
                        customIngredients: item.item_data?.customIngredients || [],
                        paidIngredients: item.item_data?.paidIngredients || [],
                        extras: item.item_data?.extras || [],
                        
                        // Acompanhamentos
                        drink: item.item_data?.drink || null,
                        border: item.item_data?.border || null,
                        
                        // Combos - preservar estrutura exata
                        comboItems: item.item_data?.comboItems || [],
                        
                        // Notas
                        notes: orderPayload.observations || null,
                      };

                      // Gerar ID único para cada item (mesmo padrão)
                      const itemId = generateItemId();

                      return {
                        id: itemId,
                        order_id: orderId,
                        product_id: item.product_id || 'unknown',
                        product_name: item.product_name || 'Produto',
                        quantity: item.quantity || 1,
                        size: item.size || 'grande',
                        total_price: item.total_price || 0,
                        item_data: itemDataObj,
                        created_at: createdAtISO,
                      };
                    });

                    console.log(`🔄 [WEBHOOK] Salvando ${itemsToInsert.length} itens em order_items...`);
                    const { error: itemsError } = await supabase
                      .from('order_items')
                      .insert(itemsToInsert);

                    if (itemsError) {
                      // ⚠️ NÃO BLOQUEAR se items falharem - order já foi criada
                      console.warn(`⚠️ [WEBHOOK] Falha ao salvar itens (order será criada mesmo assim):`, {
                        message: itemsError.message,
                        code: itemsError.code,
                      });
                    } else {
                      console.log(`✅ [WEBHOOK] ${itemsToInsert.length} itens salvos em order_items para ${orderId}`);
                    }
                  } catch (error) {
                    console.warn(`⚠️ [WEBHOOK] Exceção ao processar itens:`, error);
                  }
                } else {
                  console.warn(`⚠️ [WEBHOOK] Pedido ${orderId} sem itens para salvar`);
                }
                
                // 5️⃣ Limpar pending_pix_order
                try {
                  await supabase
                    .from('pending_pix_orders')
                    .delete()
                    .eq('id', orderId);
                  console.log(`✅ Pedido removido de pending_pix_orders`);
                } catch (error) {
                  console.warn(`⚠️ Falha ao limpar pending_pix_order:`, error);
                }
              }
            } else {
              console.warn(`⚠️ Pedido pendente não encontrado ou sem order_payload para ${orderId}. Será criado apenas registro de pagamento.`);
            }
          } else {
            console.log(`✅ Pedido ${orderId} já existe. Apenas atualizando status de pagamento...`);
          }
        } catch (error) {
          console.error(`❌ Erro ao processar pedido aprovado ${orderId}:`, error);
        }
      }

      // ============================================================
      // 🔄 UPDATE ORDER STATUS NO BANCO (se existir)
      // ============================================================
      if (orderId) {
        try {
          // Se PIX foi aprovado, muda status para "confirmado" automaticamente
          const shouldAutoConfirm = status === 'approved';
          
          const updateData: any = {
            payment_status: mpStatus,
            payment_confirmed_at: status === 'approved' ? new Date().toISOString() : null,
            mercado_pago_id: paymentId.toString(),
          };

          // PIX aprovado: mudar para "confirmed" automatically
          if (shouldAutoConfirm) {
            updateData.status = 'confirmed';
            updateData.auto_confirmed_by_pix = true;
            console.log(`🤖 PIX aprovado! Alterando automaticamente status para "confirmed"...`);
          }

          const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('tenant_id', tenantId) // ✅ MULTI-TENANT: Validar tenant_id
            .eq('id', orderId);

          if (updateError) {
            console.error(`❌ Erro ao atualizar order ${orderId}:`, updateError);
          } else {
            console.log(`✅ Order ${orderId} atualizado com status: ${mpStatus}${shouldAutoConfirm ? ' + Auto-confirmado' : ''}`);
            
            // 📱 Enviar notificação WhatsApp SE PIX foi aprovado
            if (shouldAutoConfirm) {
              try {
                // Buscar dados do pedido para notificação e impressão
                const { data: orderData, error: orderError } = await supabase
                  .from('orders')
                  .select('id, customer_name, customer_phone, tenant_id, payment_method')
                  .eq('id', orderId)
                  .single();

                if (orderError) {
                  console.warn(`⚠️ [WEBHOOK] Erro ao buscar dados do pedido ${orderId}:`, orderError.message);
                  return;
                }

                if (!orderData?.tenant_id) {
                  console.warn(`⚠️ [WEBHOOK] Pedido ${orderId} sem tenant_id, skipping notificações`);
                  return;
                }

                console.log(`✅ [WEBHOOK] Dados do pedido carregados: ID=${orderData.id}, Tenant=${orderData.tenant_id}`);

                // PHASE 3: Enfileirar jobs assincronamente via process-async-jobs
                
                // 📱 Enfileirar notificação WhatsApp SE PHONE existir
                if (orderData?.customer_phone) {
                  console.log(`📋 [WEBHOOK] Enfileirando WhatsApp para ${orderData.customer_phone}`);
                  
                  // Não aguardar - apenas enfileirar
                  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-async-jobs`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      tenantId: orderData.tenant_id,
                      orderId: orderId,
                      jobType: 'whatsapp',
                      payload: {
                        orderId: orderId,
                        status: 'confirmed',
                        phone: orderData.customer_phone,
                        customerName: orderData.customer_name || 'Cliente',
                        tenantId: orderData.tenant_id,
                      }
                    }),
                  }).catch((err) => {
                    console.warn(`⚠️ [WEBHOOK] Falha ao enfileirar WhatsApp:`, err);
                  });
                } else {
                  console.warn(`⚠️ [WEBHOOK] Pedido ${orderId} sem customer_phone, pulando WhatsApp`);
                }

                // 🖨️ Enfileirar impressão assincronamente (PHASE 3)
                console.log(`📋 [WEBHOOK] Enfileirando impressão para ${orderId}...`);
                
                // Não aguardar - apenas enfileirar
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-async-jobs`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    tenantId: orderData.tenant_id,
                    orderId: orderId,
                    jobType: 'print',
                    payload: {
                      orderId: orderId,
                      tenantId: orderData.tenant_id,
                      paymentMethod: 'pix'
                    }
                  }),
                }).catch((err) => {
                  console.warn(`⚠️ [WEBHOOK] Falha ao enfileirar impressão:`, err);
                });
                
                console.log(`✅ [WEBHOOK] Jobs enfileirados com sucesso para ${orderId} (webhook retorna imediatamente)`);

              } catch (notificationError) {
                console.warn(`⚠️ [WEBHOOK] Erro ao processar notificação/impressão:`, notificationError);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Exception ao atualizar order ${orderId}:`, error);
        }
      }

      // ============================================================
      // 📧 NOTIFICAÇÕES - TODO para desenvolvimentos futuros
      // ============================================================
      // Se rejection, notificar admin
      if (status === 'rejected') {
        console.warn(`⚠️ Pagamento rejeitado - Order ${orderId}. Considerar notificação ao admin.`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('❌ Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
