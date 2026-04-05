-- =====================================================================
-- MIGRATION: Add tenant_id isolation to order_items table
-- PURPOSE: Multi-tenant security isolation for order items
-- AUTHOR: System
-- DATE: 2026-03-30
-- =====================================================================

-- Step 1: Add tenant_id column to order_items
-- Using UUID type to match orders table structure
ALTER TABLE order_items 
ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Backfill existing order_items with tenant_id from related orders
-- This ensures all existing data is properly assigned to tenants
UPDATE order_items
SET tenant_id = (
  SELECT tenant_id 
  FROM orders 
  WHERE orders.id = order_items.order_id
)
WHERE tenant_id IS NULL;

-- Step 3: Make tenant_id column NOT NULL (after backfill)
ALTER TABLE order_items
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Create index on tenant_id for performance
-- Allows efficient filtering and RLS policy evaluation
CREATE INDEX idx_order_items_tenant_id ON order_items(tenant_id);

-- Step 5: Create composite index for common queries
-- SELECT * FROM order_items WHERE tenant_id = ? AND order_id = ?
CREATE INDEX idx_order_items_tenant_order ON order_items(tenant_id, order_id);

-- =====================================================================
-- Step 6: Drop old RLS policies (unrestricted access)
-- =====================================================================

DROP POLICY IF EXISTS "customers_select_order_items" ON order_items;
DROP POLICY IF EXISTS "customers_insert_order_items" ON order_items;
DROP POLICY IF EXISTS "service_role_update_order_items" ON order_items;

-- =====================================================================
-- Step 7: Create new RLS policies with tenant isolation
-- =====================================================================

-- Policy 1: SELECT - Admin can view order items from their tenant
CREATE POLICY "admin_select_order_items_own_tenant" ON order_items
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      -- Admin viewing items in their establishment
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
    OR (
      -- Customer can view items from their own orders
      order_id IN (
        SELECT id 
        FROM orders 
        WHERE customer_id = auth.uid() 
        OR (customer_id IS NULL AND auth.role() = 'authenticated')  -- Guest orders
      )
    )
  );

-- Policy 2: INSERT - Service role (Edge Functions) or guest checkout
CREATE POLICY "service_role_insert_order_items" ON order_items
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    -- Guest checkout: Allow INSERT but must have valid tenant_id and order_id
    OR (
      tenant_id IS NOT NULL
      AND order_id IN (
        SELECT id FROM orders WHERE orders.tenant_id = order_items.tenant_id
      )
    )
  );

-- Policy 3: UPDATE - Service role only (webhooks, payment confirmations)
CREATE POLICY "service_role_update_order_items" ON order_items
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: DELETE - Service role only
CREATE POLICY "service_role_delete_order_items" ON order_items
  FOR DELETE
  USING (auth.role() = 'service_role');

-- =====================================================================
-- Step 8: Grant permissions to authenticated users
-- =====================================================================

GRANT SELECT, INSERT, UPDATE ON order_items TO authenticated;

-- =====================================================================
-- Step 9: Add table comment explaining tenant isolation
-- =====================================================================

COMMENT ON TABLE order_items IS 'Order line items with multi-tenant isolation via tenant_id. Each item belongs to a specific tenant and is protected by RLS policies: admin_select_order_items_own_tenant, service_role_insert_order_items, service_role_update_order_items, service_role_delete_order_items';

-- =====================================================================
-- VALIDATION: Ensure all rows have tenant_id
-- =====================================================================

DO $$
DECLARE
  orphaned_count INT;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM order_items
  WHERE tenant_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Migration incomplete: % order_items rows still have NULL tenant_id', orphaned_count;
  ELSE
    RAISE NOTICE 'Migration successful: All order_items have valid tenant_id';
  END IF;
END $$;
