import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// CRON JOB: Processa fila de jobs a cada 30 segundos
// Implementa retry automático + monitoramento
// ============================================================

interface ProcessResult {
  success: boolean;
  processed: number;
  failed: number;
  queued: number;
  errors: string[];
}

/**
 * Processa a fila de jobs async
 * Pode ser chamada por: cron job, webhook, ou manualmente
 */
async function processAsyncQueue(supabase: any): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: true,
    processed: 0,
    failed: 0,
    queued: 0,
    errors: []
  };

  try {
    console.log('⏰ [CRON] Iniciando processamento de fila async...');
    
    // 1️⃣ Contar jobs pendentes
    const { count: queuedCount } = await supabase
      .from('async_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    result.queued = queuedCount || 0;
    console.log(`📊 [CRON] Jobs na fila: ${result.queued}`);

    // 2️⃣ Buscar jobs pendentes (max 20 por execução)
    const { data: jobs, error: fetchError } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .lt('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      const errorMsg = `Erro ao buscar jobs: ${fetchError.message}`;
      console.error(`❌ [CRON] ${errorMsg}`);
      result.success = false;
      result.errors.push(errorMsg);
      return result;
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ [CRON] Nenhum job pendente');
      return result;
    }

    console.log(`🔄 [CRON] Processando ${jobs.length} jobs...`);

    // 3️⃣ Processar cada job
    for (const job of jobs) {
      try {
        const success = await processJobWithRetry(supabase, job);
        if (success) {
          result.processed++;
        } else {
          result.failed++;
        }
      } catch (jobError) {
        console.error(`❌ [CRON] Erro ao processar job ${job.id}:`, jobError);
        result.failed++;
        result.errors.push(`Job ${job.id}: ${String(jobError)}`);
        
        // Incrementar tentativa
        await incrementJobAttempt(supabase, job.id, String(jobError));
      }
    }

    console.log(`✅ [CRON] Resumo: ${result.processed} processados, ${result.failed} falhados, ${result.queued} na fila`);

  } catch (error) {
    const errorMsg = `Erro geral no CRON: ${String(error)}`;
    console.error(`❌ [CRON] ${errorMsg}`);
    result.success = false;
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Processa um job individual com tratamento de erro
 */
async function processJobWithRetry(supabase: any, job: any): Promise<boolean> {
  try {
    // Marcar como processing (lock)
    await updateJobStatus(supabase, job.id, 'processing');
    
    console.log(`⚙️ [JOB] Processando: ${job.job_type} (${job.id})`);

    const { payload } = job;

    // Processar baseado no tipo
    if (job.job_type === 'whatsapp') {
      await invokeEdgeFunction(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-notification`,
        {
          ...payload,
          tenant_id: job.tenant_id,
          order_id: job.order_id
        }
      );
    } else if (job.job_type === 'print') {
      await invokeEdgeFunction(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/printorder`,
        {
          ...payload,
          tenant_id: job.tenant_id,
          order_id: job.order_id
        }
      );
    } else if (job.job_type === 'whatsapp_print') {
      // Enviar ambos em paralelo
      await Promise.all([
        invokeEdgeFunction(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-notification`,
          { ...payload, tenant_id: job.tenant_id, order_id: job.order_id }
        ),
        invokeEdgeFunction(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/printorder`,
          { ...payload, tenant_id: job.tenant_id, order_id: job.order_id }
        )
      ]);
    }

    // Marcar como concluído
    await updateJobStatus(supabase, job.id, 'completed');
    console.log(`✅ [JOB] Concluído: ${job.id}`);
    
    return true;

  } catch (error) {
    console.error(`❌ [JOB] Falha ao processar ${job.id}:`, error);
    return false;
  }
}

/**
 * Invoca Edge Function com timeout
 */
async function invokeEdgeFunction(url: string, payload: any): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Atualiza status do job
 */
async function updateJobStatus(
  supabase: any,
  jobId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('async_jobs')
    .update({
      status,
      processed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('id', jobId);

  if (error) {
    console.error(`❌ Erro ao atualizar status do job ${jobId}:`, error);
  }
}

/**
 * Incrementa tentativas e agenda retry
 */
async function incrementJobAttempt(
  supabase: any,
  jobId: string,
  lastError: string
): Promise<void> {
  // Buscar job atual para incrementar attempts
  const { data: job } = await supabase
    .from('async_jobs')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single();

  if (!job) return;

  const newAttempts = (job.attempts || 0) + 1;
  const maxAttempts = job.max_attempts || 3;

  // Se ainda tem tentativas, agendar retry
  let newStatus = 'failed';
  let newScheduledAt = null;

  if (newAttempts < maxAttempts) {
    newStatus = 'pending';
    // Retry com backoff exponencial: 60s, 300s, 900s
    const backoffMs = [60000, 300000, 900000][newAttempts - 1] || 60000;
    newScheduledAt = new Date(Date.now() + backoffMs).toISOString();
  }

  const { error } = await supabase
    .from('async_jobs')
    .update({
      attempts: newAttempts,
      status: newStatus,
      scheduled_at: newScheduledAt,
      last_error: lastError
    })
    .eq('id', jobId);

  if (error) {
    console.error(`❌ Erro ao atualizar tentativa do job ${jobId}:`, error);
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

    // Processar fila
    const result = await processAsyncQueue(supabase);

    // Log para monitoramento
    console.log('📈 [CRON] Resultado:', {
      success: result.success,
      processed: result.processed,
      failed: result.failed,
      queued: result.queued,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [CRON] Erro não capturado:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: String(error),
        processed: 0,
        failed: 0,
        queued: 0,
        errors: [String(error)]
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
