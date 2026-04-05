-- Migration: Create RLS Policies for Neighborhoods Table (30/03/2026)
-- Purpose: Allow public to read neighborhoods, service_role (Edge Functions) to manage

-- ============================================================================
-- 1. DROP OLD POLICIES if they exist
-- ============================================================================

DROP POLICY IF EXISTS "anyone_can_read_neighborhoods" ON neighborhoods;
DROP POLICY IF EXISTS "authenticated_can_insert_neighborhoods" ON neighborhoods;
DROP POLICY IF EXISTS "service_role_manage_neighborhoods" ON neighborhoods;

-- ============================================================================
-- 2. CREATE NEW POLICIES for Neighborhoods
-- ============================================================================

-- POLICY: Everyone can READ neighborhoods (public + authenticated)
CREATE POLICY "public_read_neighborhoods" ON neighborhoods
  FOR SELECT
  USING (TRUE);

-- POLICY: Service role (Edge Functions) can INSERT/UPDATE/DELETE
-- This allows our create-neighborhood Edge Function to insert neighborhoods
CREATE POLICY "service_role_manage_neighborhoods" ON neighborhoods
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

-- Allow authenticated users to read neighborhoods
GRANT SELECT ON neighborhoods TO authenticated;
GRANT SELECT ON neighborhoods TO anon;

-- ============================================================================
-- 4. COMMENTS for documentation
-- ============================================================================

COMMENT ON POLICY "public_read_neighborhoods" ON neighborhoods IS 
  'Allows everyone (public + authenticated) to read neighborhoods for pickup/delivery selection';

COMMENT ON POLICY "service_role_manage_neighborhoods" ON neighborhoods IS 
  'Allows service_role (Edge Functions) to manage neighborhoods - bypasses RLS for server-side operations';
