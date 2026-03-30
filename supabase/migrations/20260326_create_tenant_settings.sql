-- ============================================================
-- TENANT SETTINGS: Customizações por tenant
-- Data: 26/03/2026
-- ============================================================

-- Tabela principal: configurações customizáveis por tenant
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- 🍕 Cardápio & Opções
  meia_meia_enabled BOOLEAN DEFAULT true,
  imagens_enabled BOOLEAN DEFAULT true,
  adicionais_enabled BOOLEAN DEFAULT true,
  bebidas_enabled BOOLEAN DEFAULT true,
  bordas_enabled BOOLEAN DEFAULT true,
  
  -- 👨‍🍳 Customizações avançadas
  free_ingredients_enabled BOOLEAN DEFAULT false,
  free_ingredients_max INTEGER DEFAULT 6,
  
  -- 🎨 Branding
  store_name VARCHAR(255),
  store_description TEXT,
  store_logo_url VARCHAR(255),
  primary_color VARCHAR(7) DEFAULT '#FF6B35',  -- Orange pizza
  secondary_color VARCHAR(7) DEFAULT '#F7931E',
  
  -- ⏰ Horários
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  store_opens_at TIME DEFAULT '10:00',
  store_closes_at TIME DEFAULT '23:00',
  average_delivery_minutes INTEGER DEFAULT 40,
  
  -- 💳 Pagamentos
  mercadopago_enabled BOOLEAN DEFAULT true,
  pix_enabled BOOLEAN DEFAULT true,
  credit_card_enabled BOOLEAN DEFAULT true,
  
  -- 📱 Notificações
  whatsapp_notifications_enabled BOOLEAN DEFAULT true,
  whatsapp_phone_number VARCHAR(20),
  email_notifications_enabled BOOLEAN DEFAULT true,
  
  -- 🎁 Fidelização
  loyalty_enabled BOOLEAN DEFAULT true,
  loyalty_points_percentage DECIMAL(5,2) DEFAULT 1.00,  -- 1% por padrão
  loyalty_minimum_order DECIMAL(10,2) DEFAULT 20.00,
  
  -- 🌐 Status
  is_active BOOLEAN DEFAULT true,
  is_maintenance BOOLEAN DEFAULT false,
  maintenance_message VARCHAR(255),
  
  -- 📊 Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_is_active ON tenant_settings(is_active);

-- Comentários para documentação
COMMENT ON TABLE tenant_settings IS 'Configurações customizáveis por tenant - controla quais features estão ativadas';
COMMENT ON COLUMN tenant_settings.free_ingredients_enabled IS '"A Moda do Cliente" - cliente escolhe ingredientes grátis';
COMMENT ON COLUMN tenant_settings.loyalty_points_percentage IS 'Percentual de pontos ganhos (ex: 1.00 = 1% do valor)';

-- ============================================================
-- ATUALIZAR TENANTS EXISTENTES COM SETTINGS PADRÃO
-- ============================================================

-- Inserir entry de settings para cada tenant existente
INSERT INTO tenant_settings (tenant_id, store_name)
SELECT id, name FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================
-- RLS POLICIES - Isolamento por tenant_id
-- ============================================================

-- Policy 1: Leitura - apenas usuários do tenant ou service_role
CREATE POLICY "tenant_settings_read_own" ON tenant_settings
  FOR SELECT
  USING (
    -- Service role lê tudo
    auth.role() = 'service_role'
    OR
    -- Admin do tenant lê suas settings
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = tenant_settings.tenant_id
      AND tenants.id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Policy 2: Escrita - apenas service_role ou admin do tenant
CREATE POLICY "tenant_settings_update_own" ON tenant_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = tenant_settings.tenant_id
      AND tenants.id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Policy 3: Insert - apenas service_role
CREATE POLICY "tenant_settings_insert" ON tenant_settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: Delete - apenas service_role
CREATE POLICY "tenant_settings_delete" ON tenant_settings
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_tenant_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp
DROP TRIGGER IF EXISTS trigger_tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER trigger_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_tenant_settings_timestamp();

-- ============================================================
-- FUNÇÃO: Criar tenant_settings quando novo tenant é criado
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_tenant_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_settings (tenant_id, store_name)
  VALUES (NEW.id, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar settings quando tenant é criado
DROP TRIGGER IF EXISTS trigger_create_tenant_settings ON tenants;
CREATE TRIGGER trigger_create_tenant_settings
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_tenant_settings();
