-- Add missing columns to whatsapp_notification_logs (se não existirem)
-- Essas colunas são esperadas pela edge function send-whatsapp-notification
ALTER TABLE whatsapp_notification_logs
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS message_sent text,
ADD COLUMN IF NOT EXISTS success boolean,
ADD COLUMN IF NOT EXISTS error_message text;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_tenant ON whatsapp_notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_order ON whatsapp_notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_notification_logs(created_at);

-- =====================================================================
-- WHATSAPP_NOTIFICATION_LOGS TABLE - RLS Policies
-- =====================================================================

-- Policy 1: SELECT - Service_role only (logs do sistema interno)
DROP POLICY IF EXISTS "customers_select_whatsapp_logs" ON whatsapp_notification_logs;
CREATE POLICY "customers_select_whatsapp_logs" ON whatsapp_notification_logs
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Policy 2: INSERT - Service_role only (apenas edge functions registram logs)
DROP POLICY IF EXISTS "service_role_insert_whatsapp_logs" ON whatsapp_notification_logs;
CREATE POLICY "service_role_insert_whatsapp_logs" ON whatsapp_notification_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy 3: UPDATE - Service_role only (apenas update de status)
DROP POLICY IF EXISTS "service_role_update_whatsapp_logs" ON whatsapp_notification_logs;
CREATE POLICY "service_role_update_whatsapp_logs" ON whatsapp_notification_logs
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: DELETE - Service_role only (limpeza de dados)
DROP POLICY IF EXISTS "service_role_delete_whatsapp_logs" ON whatsapp_notification_logs;
CREATE POLICY "service_role_delete_whatsapp_logs" ON whatsapp_notification_logs
  FOR DELETE
  USING (auth.role() = 'service_role');
