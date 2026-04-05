-- ============================================================
-- CRITICAL FIX: Limpeza TOTAL de policies conflitantes
-- Data: 31/03/2026
-- Problema: Múltiplas policies antigas conflitando
-- Solução: Remover TUDO e criar do zero com SECURITY DEFINER
-- ============================================================

-- 🗑️ STEP 1: REMOVER TODAS as policies antigas conflitantes
DROP POLICY IF EXISTS "admin_manage_own_settings" ON tenant_settings;
DROP POLICY IF EXISTS "public_read_settings" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_delete" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_insert" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_update_own" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_read_own" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_admin_read" ON tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_admin_update" ON tenant_settings;

-- Verificar que foi limpo
SELECT 'Policies removidas. Verificando...' as status;
SELECT COUNT(*) as remaining_policies 
FROM pg_policies 
WHERE tablename = 'tenant_settings';

-- 🟢 STEP 2: Criar FUNCTION com SECURITY DEFINER
-- Esta function ignora RLS da tabela admin_users e retorna tenant_id do admin autenticado
CREATE OR REPLACE FUNCTION get_tenant_id_for_auth_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM admin_users 
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_tenant_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Dar permissão para autenticados chamarem a function
GRANT EXECUTE ON FUNCTION get_tenant_id_for_auth_user() 
TO authenticated, anon, service_role;

-- 🟢 STEP 3: Criar Policy única e simples: SELECT
-- Admin lê settings do seu tenant, service_role lê tudo
CREATE POLICY "tenant_settings_admin_read" ON tenant_settings
  FOR SELECT
  USING (
    auth.role() = 'service_role'::text
    OR
    tenant_id = get_tenant_id_for_auth_user()
  );

-- 🟢 STEP 4: Criar Policy: UPDATE
-- Admin atualiza settings do seu tenant, service_role atualiza tudo
CREATE POLICY "tenant_settings_admin_update" ON tenant_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'::text
    OR
    tenant_id = get_tenant_id_for_auth_user()
  )
  WITH CHECK (
    auth.role() = 'service_role'::text
    OR
    tenant_id = get_tenant_id_for_auth_user()
  );

-- 🟢 STEP 5: Criar Policy: INSERT
-- Apenas service_role (function/backend) cria tenant_settings
CREATE POLICY "tenant_settings_insert" ON tenant_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role'::text);

-- 🟢 STEP 6: Criar Policy: DELETE  
-- Apenas service_role (function/backend) deleta tenant_settings
CREATE POLICY "tenant_settings_delete" ON tenant_settings
  FOR DELETE
  USING (auth.role() = 'service_role'::text);

-- ✅ VERIFICAÇÃO FINAL
SELECT 
  policyname,
  permissive,
  qual
FROM pg_policies
WHERE tablename = 'tenant_settings'
ORDER BY policyname;

-- ============================================================
-- RESULTADO
-- ============================================================
-- ✅ Limpo: Removidas 6 policies antigas
-- ✅ Criada: Function get_tenant_id_for_auth_user (SECURITY DEFINER)
-- ✅ Criadas: 4 policies novas e simples
-- ✅ Admin Dashboard > Loja agora deve funcionar!
-- ============================================================
