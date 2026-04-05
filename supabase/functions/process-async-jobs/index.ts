import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// PHASE 3: Enqueue WhatsApp & Print jobs to async queue
// Called by webhook to add jobs without blocking
// ============================================================

/**
 * Enfileira um job assincronamente
 * Webhook chama isso e retorna imediatamente
 */
async function enqueueJob(
  supabase: any,
  tenantId: string,
  orderId: string,
  jobType: string,
  payload: any
): Promise<boolean> {
  try {
    console.log(`📋 [ENQUEUE] Job: ${jobType} para pedido ${orderId} (tenant: ${tenantId})`);
    
    const { error } = await supabase
      .from('async_jobs')
      .insert({
        tenant_id: tenantId,
        order_id: orderId,
        job_type: jobType,
        payload,
        status: 'pending'
      });

    if (error) {
      console.error(`❌ [ENQUEUE] Erro ao enfileirar: ${jobType}`, error);
      return false;
    }

    console.log(`✅ [ENQUEUE] Job enfileirado: ${jobType}`);
    return true;
  } catch (error) {
    console.error(`❌ [ENQUEUE] Exceção:`, error);
    return false;
  }
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

    const { tenantId, orderId, jobType, payload } = await req.json();

    // Validar campos obrigatórios
    if (!tenantId || !orderId || !jobType || !payload) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: tenantId, orderId, jobType, payload'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enfileirar job
    const success = await enqueueJob(supabase, tenantId, orderId, jobType, payload);

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Job enfileirado com sucesso' : 'Erro ao enfileirar job'
      }),
      { 
        status: success ? 201 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in enqueue-async-job:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
