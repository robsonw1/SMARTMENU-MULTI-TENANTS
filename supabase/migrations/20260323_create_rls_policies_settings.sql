-- RLS Policies for settings table
-- Settings is global config: everyone can read, only service_role can modify

-- Policy 1: Everyone can SELECT settings
CREATE POLICY "anyone_read_settings" ON settings
  FOR SELECT
  USING (TRUE);

-- Policy 2: Service role can INSERT settings
CREATE POLICY "service_role_insert_settings" ON settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy 3: Service role can UPDATE settings
CREATE POLICY "service_role_update_settings" ON settings
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: Service role can DELETE settings
CREATE POLICY "service_role_delete_settings" ON settings
  FOR DELETE
  USING (auth.role() = 'service_role');
