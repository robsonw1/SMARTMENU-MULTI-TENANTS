import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// MONITORING: Status da fila de jobs async
// Endpoint para dashboard monitorar saúde da fila
// ============================================================

interface QueueStats {
  // Geral
  total_jobs: number;
  jobs_pending: number;
  jobs_processing: number;
  jobs_completed: number;
  jobs_failed: number;
  
  // Por tipo
  by_type: {
    whatsapp: number;
    print: number;
    whatsapp_print: number;
  };
  
  // Performance
  avg_retry_attempts: number;
  max_retry_attempts: number;
  oldest_pending_job: string | null;
  oldest_pending_age_seconds: number;
  
  // Health
  health_status: 'healthy' | 'warning' | 'critical';
  health_message: string;
  
  // Timestamp
  checked_at: string;
}

/**
 * Retorna estatísticas da fila
 */
async function getQueueStats(supabase: any): Promise<QueueStats> {
  const now = new Date();

  // 1️⃣ Contar por status
  const { data: statusCounts } = await supabase
    .from('async_jobs')
    .select('status', { count: 'exact' })
    .eq('status', 'pending');

  const { data: processing } = await supabase
    .from('async_jobs')
    .select('status', { count: 'exact' })
    .eq('status', 'processing');

  const { data: completed } = await supabase
    .from('async_jobs')
    .select('status', { count: 'exact' })
    .eq('status', 'completed');

  const { data: failed } = await supabase
    .from('async_jobs')
    .select('status', { count: 'exact' })
    .eq('status', 'failed');

  const { count: total } = await supabase
    .from('async_jobs')
    .select('*', { count: 'exact', head: true });

  // 2️⃣ Contar por tipo
  const { data: byType } = await supabase
    .from('async_jobs')
    .select('job_type')
    .eq('status', 'pending');

  const typeCount = {
    whatsapp: 0,
    print: 0,
    whatsapp_print: 0
  };

  byType?.forEach((job: any) => {
    if (job.job_type in typeCount) {
      typeCount[job.job_type as keyof typeof typeCount]++;
    }
  });

  // 3️⃣ Job mais antigo
  const { data: oldestJob } = await supabase
    .from('async_jobs')
    .select('created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  let oldestAge = 0;
  if (oldestJob?.created_at) {
    oldestAge = Math.floor((now.getTime() - new Date(oldestJob.created_at).getTime()) / 1000);
  }

  // 4️⃣ Média de tentativas
  const { data: allJobs } = await supabase
    .from('async_jobs')
    .select('attempts');

  let avgAttempts = 0;
  let maxAttempts = 0;
  if (allJobs && allJobs.length > 0) {
    avgAttempts = allJobs.reduce((sum: number, job: any) => sum + (job.attempts || 0), 0) / allJobs.length;
    maxAttempts = Math.max(...allJobs.map((j: any) => j.attempts || 0));
  }

  // 5️⃣ Determinar health
  const pendingCount = statusCounts?.length || 0;
  const processingCount = processing?.length || 0;
  const completedCount = completed?.length || 0;
  const failedCount = failed?.length || 0;

  let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  let healthMessage = 'Fila operando normalmente';

  if (pendingCount > 100) {
    healthStatus = 'critical';
    healthMessage = `CRÍTICO: ${pendingCount} jobs aguardando (processador pode estar offline)`;
  } else if (pendingCount > 50) {
    healthStatus = 'warning';
    healthMessage = `AVISO: ${pendingCount} jobs na fila (monitor se cron está rodando)`;
  } else if (oldestAge > 300) {
    // Job com mais de 5 minutos na fila
    healthStatus = 'warning';
    healthMessage = `Job mais antigo com ${oldestAge}s de espera`;
  } else if (failedCount > 10) {
    healthStatus = 'warning';
    healthMessage = `${failedCount} jobs falhados (revisar erros)`;
  }

  return {
    total_jobs: total || 0,
    jobs_pending: pendingCount,
    jobs_processing: processingCount,
    jobs_completed: completedCount,
    jobs_failed: failedCount,
    by_type: typeCount,
    avg_retry_attempts: parseFloat(avgAttempts.toFixed(2)),
    max_retry_attempts: maxAttempts,
    oldest_pending_job: oldestJob?.created_at || null,
    oldest_pending_age_seconds: oldestAge,
    health_status: healthStatus,
    health_message: healthMessage,
    checked_at: now.toISOString()
  };
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

    const stats = await getQueueStats(supabase);

    // Log para debug
    console.log('📊 [MONITOR] Queue Stats:', {
      total: stats.total_jobs,
      pending: stats.jobs_pending,
      health: stats.health_status
    });

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [MONITOR] Error:', error);
    return new Response(
      JSON.stringify({
        error: String(error),
        health_status: 'critical',
        health_message: 'Erro ao consultar status da fila'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
