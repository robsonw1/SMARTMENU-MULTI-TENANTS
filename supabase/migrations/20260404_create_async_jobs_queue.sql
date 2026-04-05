-- ============================================================
-- CRIAR: Tabela para Queue Async de WhatsApp e Print
-- Data: 04/04/2026
-- Objetivo: Enfileirar jobs assincronamente em vez de bloquear
--           webhook esperando WhatsApp/Print completar
-- ============================================================

-- 🟢 CRIAR tabela async_jobs para queue
CREATE TABLE IF NOT EXISTS public.async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  
  -- Job identification
  tenant_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'whatsapp' | 'print' | 'whatsapp_print'
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  
  -- Indexes for querying
  CONSTRAINT fk_tenant_id FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT valid_job_type 
    CHECK (job_type IN ('whatsapp', 'print', 'whatsapp_print'))
);

-- 🔍 ÍNDICES para performance
CREATE INDEX idx_async_jobs_tenant_id_status 
ON public.async_jobs(tenant_id, status);

CREATE INDEX idx_async_jobs_status_scheduled 
ON public.async_jobs(status, scheduled_at) 
WHERE status = 'pending';

CREATE INDEX idx_async_jobs_created_at 
ON public.async_jobs(created_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;

-- Service role full access (para Edge Functions)
CREATE POLICY "Service role full access" 
ON public.async_jobs
FOR ALL USING (true)
WITH CHECK (true);

-- ============================================================
-- FUNCTION: AUTO-CLEANUP expirados
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_async_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.async_jobs
  WHERE status IN ('completed', 'failed')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 
  'Tabela async_jobs criada com sucesso!' as status,
  COUNT(*) as total_jobs
FROM public.async_jobs;

-- ============================================================
-- PRONTO
-- ============================================================
-- ✅ Tabela async_jobs criada
-- ✅ RLS policies aplicadas
-- ✅ Índices criados para performance
-- ✅ Pronto para enfileirar jobs
-- ✅ Webhook pode retornar imediatamente
-- ============================================================
