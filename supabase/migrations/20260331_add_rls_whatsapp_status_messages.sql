-- RLS Policies para whatsapp_status_messages (Opção A: 7 slots fixos)
-- UPSERT Pattern com Soft Delete via enabled=false
-- UNIQUE(tenant_id, status) previne duplicatas

-- ✅ ENABLE RLS
ALTER TABLE whatsapp_status_messages ENABLE ROW LEVEL SECURITY;

-- 🔑 POLICY 1: Admins SELECT apenas de seu tenant
CREATE POLICY "admin_select_own_tenant"
ON whatsapp_status_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
      AND au.tenant_id = whatsapp_status_messages.tenant_id
  )
);

-- 🔑 POLICY 2: Admins UPDATE apenas de seu tenant
CREATE POLICY "admin_update_own_tenant"
ON whatsapp_status_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
      AND au.tenant_id = whatsapp_status_messages.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.id = auth.uid()
      AND au.tenant_id = whatsapp_status_messages.tenant_id
  )
);

-- 🔑 POLICY 3: Service role INSERT (Edge Function)
CREATE POLICY "service_role_insert"
ON whatsapp_status_messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- 🔑 POLICY 4: Service role UPDATE (Edge Function)
CREATE POLICY "service_role_update"
ON whatsapp_status_messages
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 🔑 POLICY 5: Service role DELETE (Edge Function - soft delete via enabled=false é preferido)
CREATE POLICY "service_role_delete"
ON whatsapp_status_messages
FOR DELETE
TO service_role
USING (true);

-- 📊 Criar índice composto para performance (tenant_id + status)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_status 
  ON whatsapp_status_messages(tenant_id, status);

-- 📊 Criar índice para queries por enabled status
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_enabled 
  ON whatsapp_status_messages(tenant_id, enabled);

-- 📝 Garantir UNIQUE constraint para prevenir duplicatas
-- Nota: UNIQUE(tenant_id, status) já foi criado na tabela original (add_evolution_whatsapp_config.sql)
-- Aqui apenas confirmamos que está em vigor

-- 🔄 Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whatsapp_messages_update_timestamp ON whatsapp_status_messages;
CREATE TRIGGER whatsapp_messages_update_timestamp
BEFORE UPDATE ON whatsapp_status_messages
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_messages_updated_at();

-- 📋 Comentários para documentação
COMMENT ON TABLE whatsapp_status_messages IS 'Templates de mensagens WhatsApp (7 slots fixos por tenant) - UPSERT Pattern com soft delete via enabled=false';
COMMENT ON COLUMN whatsapp_status_messages.tenant_id IS 'Identificador do tenant (pizzeria)';
COMMENT ON COLUMN whatsapp_status_messages.status IS 'Um de: pending, confirmed, preparing, delivering, delivered, cancelled, agendado';
COMMENT ON COLUMN whatsapp_status_messages.message_template IS 'Conteúdo do template com placeholders {nome}, {pedido}, {hora_entrega}';
COMMENT ON COLUMN whatsapp_status_messages.enabled IS 'Se false = soft delete (mantém auditoria)';
