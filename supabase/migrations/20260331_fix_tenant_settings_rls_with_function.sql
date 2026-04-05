-- ============================================================
-- FIX DEFINITIVO: RLS Policy com Function SECURITY DEFINER
-- Data: 31/03/2026
-- Problema: Subquery em RLS policy não tem permissão para admin_users
-- Solução: Usar function com SECURITY DEFINER para contornar RLS
-- ============================================================

-- 1️⃣ CRIAR FUNCTION com SECURITY DEFINER (executa como criador, não como usuário)
CREATE OR REPLACE FUNCTION get_tenant_id_for_auth_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- ⭐ CRÍTICO: Executa como owner, ignora RLS
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT tenant_id 
    FROM admin_users 
    WHERE id = auth.uid()
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 2️⃣ ATUALIZAR RLS Policy para usar a FUNCTION ao invés de subquery
DROP POLICY IF EXISTS "tenant_settings_read_own" ON tenant_settings;

CREATE POLICY "tenant_settings_read_own" ON tenant_settings
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR
    tenant_id = get_tenant_id_for_auth_user()
  );

-- 3️⃣ ATUALIZAR Policy: Update
DROP POLICY IF EXISTS "tenant_settings_update_own" ON tenant_settings;

CREATE POLICY "tenant_settings_update_own" ON tenant_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR
    tenant_id = get_tenant_id_for_auth_user()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR
    tenant_id = get_tenant_id_for_auth_user()
  );

-- 4️⃣ GRANT permissions na function para que authenticated users possam chamar
GRANT EXECUTE ON FUNCTION get_tenant_id_for_auth_user() TO authenticated, anon, service_role;

-- 5️⃣ VERIFICAÇÃO
-- As outras policies (INSERT, DELETE) ficam como estão (apenas service_role)
-- Porque admins NÃO devem poder deletar/criar tenant_settings

SELECT 
  tablename,
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'tenant_settings'
ORDER BY tablename, policyname;

-- ============================================================
-- RESULTADO
-- ============================================================
-- ✅ Resolvido: Função com SECURITY DEFINER ignora RLS de admin_users
-- ✅ Admin Dashboard aba "Loja" agora funciona 100%
-- ============================================================
