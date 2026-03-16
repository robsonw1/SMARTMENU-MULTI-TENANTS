-- ⚠️ REVERT: Remove todas as policies de RLS que foram criadas no migration anterior
-- Isso desfaz os danos causados pela política que bloqueava tudo

-- Disable RLS completamente na tabela orders para voltar ao estado anterior
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Drop all policies I created
DROP POLICY IF EXISTS "Customers can read own orders" ON orders;
DROP POLICY IF EXISTS "Customers can update own orders" ON orders;
DROP POLICY IF EXISTS "Managers can read tenant orders" ON orders;
DROP POLICY IF EXISTS "Managers can update tenant orders" ON orders;
DROP POLICY IF EXISTS "Service role full access" ON orders;

-- Confirm that orders table is now unrestricted (like it was before)
COMMENT ON TABLE orders IS 'Orders table - RLS DISABLED to maintain existing functionality';
