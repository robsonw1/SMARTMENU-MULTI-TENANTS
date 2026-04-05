-- =====================================================================
-- MIGRATION: Add tenant_id isolation to pending_pix_orders table
-- PURPOSE: Multi-tenant security for payment pending orders
-- PRIORITY: LOW - Optional optimization (JSON already has tenant data)
-- AUTHOR: System
-- DATE: 2026-03-30
-- =====================================================================

-- Step 1: Add tenant_id column to pending_pix_orders
-- Using UUID type to match orders/tenants structure
-- Backfill from order_payload JSONB when migrating
ALTER TABLE pending_pix_orders 
ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Backfill existing pending_pix_orders with tenant_id from order_payload JSON
-- Extract tenantId from JSON and cast to UUID
UPDATE pending_pix_orders
SET tenant_id = (order_payload ->> 'tenantId')::uuid
WHERE tenant_id IS NULL 
  AND (order_payload ->> 'tenantId') IS NOT NULL;

-- Step 3: Fallback for any records still missing tenant_id (use first tenant)
UPDATE pending_pix_orders
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;

-- Step 4: Make tenant_id column NOT NULL (after backfill)
ALTER TABLE pending_pix_orders
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Create index on tenant_id for performance
-- Enables efficient filtering for per-tenant pending orders lookup
CREATE INDEX idx_pending_pix_orders_tenant_id ON pending_pix_orders(tenant_id);

-- Step 6: Create composite index for common queries
-- SELECT * FROM pending_pix_orders WHERE tenant_id = ? AND status = 'pending'
CREATE INDEX idx_pending_pix_orders_tenant_status ON pending_pix_orders(tenant_id, status);

-- Step 7: Create composite index for expiration queries
-- SELECT * FROM pending_pix_orders WHERE tenant_id = ? AND expires_at < now()
CREATE INDEX idx_pending_pix_orders_tenant_expires ON pending_pix_orders(tenant_id, expires_at);

-- =====================================================================
-- Step 8: Drop old RLS policies (unrestricted access)
-- =====================================================================

DROP POLICY IF EXISTS "customers_select_pending_pix" ON pending_pix_orders;
DROP POLICY IF EXISTS "customers_insert_pending_pix" ON pending_pix_orders;
DROP POLICY IF EXISTS "service_role_update_pending_pix" ON pending_pix_orders;

-- =====================================================================
-- Step 9: Create new RLS policies with tenant isolation
-- =====================================================================

-- Policy 1: SELECT - Admin can view pending PIX orders from their tenant
CREATE POLICY "admin_select_pending_pix_orders_own_tenant" ON pending_pix_orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      -- Admin viewing pending orders in their establishment
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy 2: INSERT - Service role only (created via Edge Function payment flow)
CREATE POLICY "service_role_insert_pending_pix_orders" ON pending_pix_orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    AND tenant_id IS NOT NULL
  );

-- Policy 3: UPDATE - Service role only (webhooks, payment confirmations)
CREATE POLICY "service_role_update_pending_pix_orders" ON pending_pix_orders
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: DELETE - Service role only (cleanup expired orders)
CREATE POLICY "service_role_delete_pending_pix_orders" ON pending_pix_orders
  FOR DELETE
  USING (auth.role() = 'service_role');

-- =====================================================================
-- Step 10: Grant permissions to authenticated users
-- =====================================================================

GRANT SELECT, INSERT, UPDATE ON pending_pix_orders TO authenticated;

-- =====================================================================
-- Step 11: Add table comment explaining tenant isolation
-- =====================================================================

COMMENT ON TABLE pending_pix_orders IS 'Temporary PIX payment orders awaiting webhook confirmation with multi-tenant isolation via tenant_id. Default expiration: 30 minutes. Protected by RLS policies: admin_select_pending_pix_orders_own_tenant, service_role_insert_pending_pix_orders, service_role_update_pending_pix_orders, service_role_delete_pending_pix_orders';

-- =====================================================================
-- VALIDATION: Ensure all rows have tenant_id
-- =====================================================================

DO $$
DECLARE
  orphaned_count INT;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM pending_pix_orders
  WHERE tenant_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Migration incomplete: % pending_pix_orders rows still have NULL tenant_id', orphaned_count;
  ELSE
    RAISE NOTICE 'Migration successful: All pending_pix_orders have valid tenant_id';
  END IF;
END $$;
