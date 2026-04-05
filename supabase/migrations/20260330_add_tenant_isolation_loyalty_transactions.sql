-- =====================================================================
-- MIGRATION: Add tenant_id isolation to loyalty_transactions table
-- PURPOSE: Multi-tenant security isolation for loyalty audit trail
-- PRIORITY: HIGH - Prevents admin data leakage between establishments
-- AUTHOR: System
-- DATE: 2026-03-30
-- =====================================================================

-- Step 1: Add tenant_id column to loyalty_transactions
-- Using UUID type to match orders/tenants structure
ALTER TABLE loyalty_transactions 
ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Backfill existing loyalty_transactions with tenant_id from related orders
-- This ensures all existing data is properly assigned to tenants
-- If order_id exists, use order's tenant_id; otherwise, use default tenant
UPDATE loyalty_transactions
SET tenant_id = COALESCE(
  (SELECT tenant_id FROM orders WHERE orders.id = loyalty_transactions.order_id),
  (SELECT id FROM tenants LIMIT 1)  -- Fallback to first tenant if no order
)
WHERE tenant_id IS NULL;

-- Step 3: Make tenant_id column NOT NULL (after backfill)
ALTER TABLE loyalty_transactions
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Create index on tenant_id for performance
-- Enables efficient filtering and RLS policy evaluation
CREATE INDEX idx_loyalty_transactions_tenant_id ON loyalty_transactions(tenant_id);

-- Step 5: Create composite index for common queries
-- SELECT * FROM loyalty_transactions WHERE tenant_id = ? AND customer_id = ?
CREATE INDEX idx_loyalty_transactions_tenant_customer ON loyalty_transactions(tenant_id, customer_id);

-- Step 6: Create composite index for transaction history by date
-- SELECT * FROM loyalty_transactions WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at
CREATE INDEX idx_loyalty_transactions_tenant_customer_created ON loyalty_transactions(tenant_id, customer_id, created_at DESC);

-- =====================================================================
-- Step 7: Drop old RLS policies (unrestricted access)
-- =====================================================================

DROP POLICY IF EXISTS "Allow read all transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Allow insert transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Transactions are immutable" ON loyalty_transactions;
DROP POLICY IF EXISTS "Prevent transaction deletion" ON loyalty_transactions;
DROP POLICY IF EXISTS "Allow public read access to loyalty_transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Allow public insert to loyalty_transactions" ON loyalty_transactions;

-- =====================================================================
-- Step 8: Create new RLS policies with tenant isolation
-- =====================================================================

-- Policy 1: SELECT - Admin can view transactions from their tenant only
CREATE POLICY "admin_select_loyalty_transactions_own_tenant" ON loyalty_transactions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      -- Admin viewing transactions in their establishment
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
    OR (
      -- Customer can view their own transactions (historical)
      customer_id IN (
        SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

-- Policy 2: INSERT - Service role (Edge Functions) only for recording transactions
CREATE POLICY "service_role_insert_loyalty_transactions" ON loyalty_transactions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    -- Validate tenant_id is not null (required)
    AND tenant_id IS NOT NULL
  );

-- Policy 3: UPDATE - Service role only (no manual edits - audit log)
CREATE POLICY "service_role_update_loyalty_transactions" ON loyalty_transactions
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: DELETE - Service role only (immutable by design - audit trail)
CREATE POLICY "service_role_delete_loyalty_transactions" ON loyalty_transactions
  FOR DELETE
  USING (auth.role() = 'service_role');

-- =====================================================================
-- Step 9: Grant permissions to authenticated users
-- =====================================================================

GRANT SELECT, INSERT ON loyalty_transactions TO authenticated;

-- =====================================================================
-- Step 10: Add table comment explaining tenant isolation
-- =====================================================================

COMMENT ON TABLE loyalty_transactions IS 'Loyalty transaction audit trail with multi-tenant isolation via tenant_id. Immutable log: tracks points earned, redeemed, and expired. Protected by RLS policies: admin_select_loyalty_transactions_own_tenant, service_role_insert_loyalty_transactions, service_role_update_loyalty_transactions, service_role_delete_loyalty_transactions';

-- =====================================================================
-- VALIDATION: Ensure all rows have tenant_id
-- =====================================================================

DO $$
DECLARE
  orphaned_count INT;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM loyalty_transactions
  WHERE tenant_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Migration incomplete: % loyalty_transactions rows still have NULL tenant_id', orphaned_count;
  ELSE
    RAISE NOTICE 'Migration successful: All loyalty_transactions have valid tenant_id';
  END IF;
END $$;
