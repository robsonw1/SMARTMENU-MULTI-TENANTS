import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
}

interface WhatsAppTemplate {
  id?: string
  tenant_id: string
  status: string
  message_template: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

const STATUS_TYPES = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'agendado']

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar Supabase com service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extrair tenant_id do header (vem do cliente autenticado via RLS)
    const tenantId = req.headers.get('x-tenant-id')
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing x-tenant-id header' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const method = req.method
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    // GET /whatsapp-templates?status=pending (buscar 1 template específico ou todos)
    if (method === 'GET') {
      if (status) {
        // Buscar template específico
        const { data, error } = await supabase
          .from('whatsapp_status_messages')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', status)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: 'Template not found' }),
            { status: 404, headers: corsHeaders }
          )
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: corsHeaders }
        )
      } else {
        // Buscar todos os templates do tenant
        const { data, error } = await supabase
          .from('whatsapp_status_messages')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('status', { ascending: true })

        if (error) throw error

        // Garantir que todos os 7 status existem (criar se não existirem)
        const existing = data || []
        const existingStatuses = new Set(existing.map((t: any) => t.status))
        const missing = STATUS_TYPES.filter((s) => !existingStatuses.has(s))

        if (missing.length > 0) {
          const defaults: any[] = missing.map((s) => ({
            tenant_id: tenantId,
            status: s,
            message_template: getDefaultTemplate(s),
            enabled: true,
          }))

          const { data: created, error: insertError } = await supabase
            .from('whatsapp_status_messages')
            .insert(defaults)
            .select()

          if (insertError) throw insertError

          return new Response(
            JSON.stringify([...existing, ...(created || [])]),
            { status: 200, headers: corsHeaders }
          )
        }

        return new Response(
          JSON.stringify(existing),
          { status: 200, headers: corsHeaders }
        )
      }
    }

    // PUT /whatsapp-templates?status=pending (atualizar ou criar - UPSERT)
    if (method === 'PUT') {
      if (!status) {
        return new Response(
          JSON.stringify({ error: 'Missing status query parameter' }),
          { status: 400, headers: corsHeaders }
        )
      }

      const body = await req.json()
      const { message_template, enabled } = body

      if (!message_template) {
        return new Response(
          JSON.stringify({ error: 'Missing message_template in body' }),
          { status: 400, headers: corsHeaders }
        )
      }

      // UPSERT Pattern: Try UPDATE first, then INSERT if not found
      const { data: dataUpdate, error: errorUpdate } = await supabase
        .from('whatsapp_status_messages')
        .update({
          message_template,
          enabled: enabled !== undefined ? enabled : true,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .select()

      if (errorUpdate && errorUpdate.code !== 'PGRST116') {
        throw errorUpdate
      }

      if (dataUpdate && dataUpdate.length > 0) {
        // UPDATE foi bem-sucedido
        return new Response(
          JSON.stringify(dataUpdate[0]),
          { status: 200, headers: corsHeaders }
        )
      }

      // INSERT novo template
      const { data: dataInsert, error: errorInsert } = await supabase
        .from('whatsapp_status_messages')
        .insert({
          tenant_id: tenantId,
          status,
          message_template,
          enabled: enabled !== undefined ? enabled : true,
        })
        .select()
        .single()

      if (errorInsert) throw errorInsert

      return new Response(
        JSON.stringify(dataInsert),
        { status: 201, headers: corsHeaders }
      )
    }

    // DELETE /whatsapp-templates?status=pending (soft delete via enabled=false)
    if (method === 'DELETE') {
      if (!status) {
        return new Response(
          JSON.stringify({ error: 'Missing status query parameter' }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Soft delete: apenas marca como disabled
      const { data, error } = await supabase
        .from('whatsapp_status_messages')
        .update({
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Template soft-deleted' }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Erro na Edge Function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})

function getDefaultTemplate(status: string): string {
  const defaults: Record<string, string> = {
    pending: '📋 Oi {nome}! Recebemos seu pedido #{pedido}. Você receberá uma confirmação em breve!',
    confirmed: '🔵 Oi {nome}! Seu pedido #{pedido} foi confirmado! ⏱️ Saindo do forno em ~25min',
    preparing: '👨‍🍳 Seu pedido #{pedido} está sendo preparado com capricho!',
    delivering: '🚗 Seu pedido #{pedido} está a caminho! 📍 Chega em ~15min',
    delivered: '✅ Pedido #{pedido} entregue! Valeu pela compra 🙏',
    cancelled: '❌ Pedido #{pedido} foi cancelado. Em caso de dúvidas, nos contate!',
    agendado: '📅 Seu pedido #{pedido} foi agendado! Confirmaremos a preparação com você.',
  }
  return defaults[status] || `Status: ${status}`
}
