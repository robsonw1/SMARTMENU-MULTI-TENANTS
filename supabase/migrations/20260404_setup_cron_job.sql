-- ============================================================
-- SETUP: Configuração do Cron Job para processor fila async
-- Data: 04/04/2026
-- Objetivo: Processar jobs pending automaticamente a cada 30s
-- ============================================================

-- 🟢 TABELA: job_logs (opcional, para auditoria)
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  
  -- Execução
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Resultado
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  queued_count INTEGER DEFAULT 0,
  
  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Index
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🔍 ÍNDICES
CREATE INDEX idx_cron_job_logs_execution_time 
ON public.cron_job_logs(execution_time DESC);

-- ============================================================
-- AUTO-CLEANUP: Remover jobs completados/falhados > 24h
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_async_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.async_jobs
  WHERE (status = 'completed' OR status = 'failed')
    AND expires_at < NOW();
  
  -- Also cleanup old cron logs (> 7 days)
  DELETE FROM public.cron_job_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER AUTOMÁTICO: Chamar cleanup a cada 1h
-- (Alternativa: pode ser um cron job também)
-- ============================================================
-- Note: Supabase não tem trigger de tempo nativo
-- Alternativa: Chamar cleanup dentro do process-cron function

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 
  'Setup de Cron Job concluído!' as status,
  COUNT(*) as total_async_jobs
FROM public.async_jobs;

-- ============================================================
-- INSTRUÇÕES DE DEPLOYMENT (veja documento separado)
-- ============================================================
-- Deployment instructions: Ver CRON_JOB_DEPLOYMENT_GUIDE.md
-- 1. Deploy function: supabase functions deploy process-cron
-- 2. Schedule: */30 * * * * (a cada 30 segundos)
-- 3. Monitor: SELECT * FROM cron_job_logs

-- ============================================================
-- PRONTO
-- ============================================================
