-- ============================================================
-- CONSOLIDAÇÃO: Adicionar toggles à tabela settings
-- Data: 01/04/2026
-- SUPER SIMPLES: Apenas adiciona 7 colunas
-- ============================================================

-- 🟢 ADICIONAR as 7 colunas de toggles à tabela settings
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS meia_meia_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS imagens_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS adicionais_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bebidas_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bordas_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS free_ingredients_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS free_ingredients_max integer DEFAULT 6;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 
  'Colunas Adicionadas com Sucesso!' as status,
  COUNT(*) as total_settings
FROM public.settings;

-- ============================================================
-- PRONTO
-- ============================================================
-- ✅ 7 colunas adicionadas a settings
-- ✅ Toggles agora estão em settings (local correto para configurações)
-- ✅ tenant_settings foi removida manualmente antes
-- ============================================================
