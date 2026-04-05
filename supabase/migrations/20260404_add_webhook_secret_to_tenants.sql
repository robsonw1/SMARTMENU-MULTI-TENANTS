-- ============================================================
-- ADICIONAR: webhook_secret à tabela tenants
-- Data: 04/04/2026
-- Objetivo: Armazenar secret do webhook do Mercado Pago
--           para validar webhooks da conta do próprio establishment
-- ============================================================

-- 🟢 ADICIONAR colunas de pagamento à tabela tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS webhook_secret text,
ADD COLUMN IF NOT EXISTS mercadopago_access_token text,
ADD COLUMN IF NOT EXISTS mercadopago_user_id text;

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_tenants_webhook_secret 
ON public.tenants(webhook_secret);

CREATE INDEX IF NOT EXISTS idx_tenants_mercadopago_access_token 
ON public.tenants(mercadopago_access_token);

-- ============================================================
-- COMENTÁRIO PARA CONTEXTO
-- ============================================================
COMMENT ON COLUMN public.tenants.webhook_secret IS 
'Secret do webhook Mercado Pago de cada estabelecimento. 
Usado para validar assinatura dos webhooks que chegam direto na conta do tenant.
Alvo da estratégia webhook_secret_per_tenant (04/04/2026)';

COMMENT ON COLUMN public.tenants.mercadopago_access_token IS 
'Access token do Mercado Pago para cada estabelecimento. 
Usado para fazer requisições à API do Mercado Pago em nome do tenant.';

COMMENT ON COLUMN public.tenants.mercadopago_user_id IS 
'User ID do Mercado Pago para cada estabelecimento. 
Identifica o seller/account na plataforma do Mercado Pago.';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 
  'Coluna webhook_secret adicionada com sucesso!' as status,
  COUNT(*) as total_tenants
FROM public.tenants;

-- ============================================================
-- PRONTO
-- ============================================================
-- ✅ Coluna webhook_secret adicionada
-- ✅ Pronto para exibir no Admin
-- ✅ Pronto para validar webhooks per-tenant
-- ============================================================
