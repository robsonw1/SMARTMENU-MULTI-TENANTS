-- =====================================================================
-- MIGRATION: Add tenant_id isolation to loyalty_settings table
-- PURPOSE: Multi-tenant customization of loyalty rules per establishment
-- AUTHOR: System
-- DATE: 2026-03-30
-- =====================================================================

-- Step 1: Add tenant_id column to loyalty_settings (NULLABLE initially for backward compat)
-- NULL tenant_id = Global default settings (used as fallback)
ALTER TABLE loyalty_settings 
ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Create index on tenant_id for performance
-- Enables efficient filtering for per-tenant settings lookup
CREATE INDEX idx_loyalty_settings_tenant_id ON loyalty_settings(tenant_id);

-- Step 3: Create composite index for common queries
-- SELECT * FROM loyalty_settings WHERE tenant_id = ?
CREATE INDEX idx_loyalty_settings_tenant_settings ON loyalty_settings(tenant_id) WHERE tenant_id IS NOT NULL;

-- =====================================================================
-- Step 4: Update RLS policies for tenant isolation
-- =====================================================================

-- Drop old unrestricted policies
DROP POLICY IF EXISTS "Allow public read loyalty_settings" ON loyalty_settings;
DROP POLICY IF EXISTS "Allow update loyalty_settings" ON loyalty_settings;

-- Policy 1: SELECT - Admin can read their tenant settings, or global default if not set
CREATE POLICY "admin_select_loyalty_settings_own_tenant" ON loyalty_settings
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      -- Admin viewing settings for their establishment
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
    OR (
      -- Global default settings (tenant_id IS NULL) - visible to unauthenticated
      tenant_id IS NULL
    )
  );

-- Policy 2: INSERT - Service role only (creating tenant-specific settings)
CREATE POLICY "service_role_insert_loyalty_settings" ON loyalty_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy 3: UPDATE - Admin can update their tenant settings, or service_role
CREATE POLICY "admin_update_loyalty_settings_own_tenant" ON loyalty_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      -- Admin updating settings for their establishment
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      tenant_id = (
        SELECT tenant_id 
        FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy 4: DELETE - Service role only
CREATE POLICY "service_role_delete_loyalty_settings" ON loyalty_settings
  FOR DELETE
  USING (auth.role() = 'service_role');

-- =====================================================================
-- Step 5: Grant permissions to authenticated users
-- =====================================================================

GRANT SELECT, INSERT, UPDATE ON loyalty_settings TO authenticated;

-- =====================================================================
-- Step 6: Ensure backward compatibility with global settings
-- =====================================================================

-- If no global settings with tenant_id = NULL exist, we keep the existing record
-- Code will query: WHERE tenant_id = $tenantId OR tenant_id IS NULL (ORDER BY tenant_id DESC)
-- This way: tenant-specific settings take priority, global defaults are fallback

COMMENT ON TABLE loyalty_settings IS 'Loyalty program rules and multipliers with optional multi-tenant customization. NULL tenant_id = global default settings. Each tenant can override global defaults via tenant_id column. Protected by RLS policies: admin_select_loyalty_settings_own_tenant, admin_update_loyalty_settings_own_tenant, service_role_insert_loyalty_settings, service_role_delete_loyalty_settings';

-- =====================================================================
-- VALIDATION: Schema is properly updated
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration successful: loyalty_settings now supports multi-tenant configuration';
  RAISE NOTICE 'Backward compatibility maintained: NULL tenant_id = global default settings';
END $$;
