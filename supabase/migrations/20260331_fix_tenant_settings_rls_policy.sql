-- ============================================================
-- FIX: RLS Policy para tenant_settings (Admin via admin_users)
-- Data: 31/03/2026
-- Problema: Policy quebrada tentava ler tenant_id do JWT
-- Solução: Buscar tenant_id da tabela admin_users
-- ============================================================

-- 🔴 REMOVER policy quebrada
DROP POLICY IF EXISTS "tenant_settings_read_own" ON tenant_settings;

-- ✅ RECRIAR policy com lógica correta (READ)
-- Admin lê suas configurações buscando tenant_id em admin_users
CREATE POLICY "tenant_settings_read_own" ON tenant_settings
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR
    tenant_id = (
      SELECT tenant_id 
      FROM admin_users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- ============================================================
-- ATUALIZAR Policy 2: Update
-- ============================================================
DROP POLICY IF EXISTS "tenant_settings_update_own" ON tenant_settings;
CREATE POLICY "tenant_settings_update_own" ON tenant_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR
    tenant_id = (
      SELECT tenant_id 
      FROM admin_users
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- ============================================================
-- ATUALIZAR Policy 3: Insert
-- ============================================================
DROP POLICY IF EXISTS "tenant_settings_insert" ON tenant_settings;
CREATE POLICY "tenant_settings_insert" ON tenant_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- ATUALIZAR Policy 4: Delete
-- ============================================================
DROP POLICY IF EXISTS "tenant_settings_delete" ON tenant_settings;
CREATE POLICY "tenant_settings_delete" ON tenant_settings
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================
-- VERIFICAÇÃO: Validar policies foram criadas
-- ============================================================
-- SELECT * FROM pg_policies WHERE tablename = 'tenant_settings';

-- ============================================================
-- RESULTADO
-- ============================================================
-- ✅ Fixed: tenant_settings.tenant_settings_read_own
--    Antes: (auth.jwt() ->> 'tenant_id')::uuid (NÃO EXISTE)
--    Depois: Busca admin_users.tenant_id (CORRETO)
--
-- ✅ Result: Admin dashboard aba "Loja" agora funciona 100%
-- ============================================================
