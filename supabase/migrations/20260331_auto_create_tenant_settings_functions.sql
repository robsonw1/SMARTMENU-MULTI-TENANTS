-- ============================================================
-- AUTO-CREATE TENANT SETTINGS COM RPC FUNCTIONS
-- Data: 31/03/2026
-- Propósito: Garantir que tenant_settings SEMPRE existe com defaults
-- ============================================================

-- �️ STEP 0: REMOVER FUNÇÕES ANTIGAS (se existem)
DROP FUNCTION IF EXISTS ensure_tenant_settings(UUID) CASCADE;
DROP FUNCTION IF EXISTS upsert_tenant_settings(UUID, JSONB) CASCADE;

-- �🟢 FUNCTION 1: ensure_tenant_settings()
-- Se não existe → cria com defaults
-- Se existe → retorna dados existentes
-- NÃO FALHA: Sempre retorna dados
CREATE OR REPLACE FUNCTION ensure_tenant_settings(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  meia_meia_enabled BOOLEAN,
  imagens_enabled BOOLEAN,
  adicionais_enabled BOOLEAN,
  bebidas_enabled BOOLEAN,
  bordas_enabled BOOLEAN,
  free_ingredients_enabled BOOLEAN,
  free_ingredients_max INTEGER,
  store_name VARCHAR,
  store_description TEXT,
  store_logo_url VARCHAR,
  primary_color VARCHAR,
  secondary_color VARCHAR,
  timezone VARCHAR,
  store_opens_at TIME,
  store_closes_at TIME,
  average_delivery_minutes INTEGER,
  mercadopago_enabled BOOLEAN,
  pix_enabled BOOLEAN,
  credit_card_enabled BOOLEAN,
  whatsapp_notifications_enabled BOOLEAN,
  whatsapp_phone_number VARCHAR,
  email_notifications_enabled BOOLEAN,
  loyalty_enabled BOOLEAN,
  loyalty_points_percentage NUMERIC,
  loyalty_minimum_order NUMERIC,
  is_active BOOLEAN,
  is_maintenance BOOLEAN,
  maintenance_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings tenant_settings;
BEGIN
  -- STEP 1: Tentar carregar dados existentes
  SELECT * INTO v_settings FROM tenant_settings 
  WHERE tenant_id = p_tenant_id;

  -- STEP 2: Se não existe, criar com defaults
  IF v_settings IS NULL THEN
    INSERT INTO tenant_settings (
      tenant_id,
      meia_meia_enabled,
      imagens_enabled,
      adicionais_enabled,
      bebidas_enabled,
      bordas_enabled,
      free_ingredients_enabled,
      free_ingredients_max,
      store_name,
      store_description,
      store_logo_url,
      primary_color,
      secondary_color,
      timezone,
      store_opens_at,
      store_closes_at,
      average_delivery_minutes,
      mercadopago_enabled,
      pix_enabled,
      credit_card_enabled,
      whatsapp_notifications_enabled,
      whatsapp_phone_number,
      email_notifications_enabled,
      loyalty_enabled,
      loyalty_points_percentage,
      loyalty_minimum_order,
      is_active,
      is_maintenance,
      maintenance_message
    ) VALUES (
      p_tenant_id,
      true,    -- meia_meia_enabled
      true,    -- imagens_enabled
      true,    -- adicionais_enabled
      true,    -- bebidas_enabled
      true,    -- bordas_enabled
      false,   -- free_ingredients_enabled
      6,       -- free_ingredients_max
      'Sua Loja', -- store_name
      'Bem-vindo!', -- store_description
      NULL,    -- store_logo_url
      '#FF6B35', -- primary_color
      '#F7931E', -- secondary_color
      'America/Sao_Paulo', -- timezone
      '10:00'::TIME, -- store_opens_at
      '22:00'::TIME, -- store_closes_at
      30,      -- average_delivery_minutes
      false,   -- mercadopago_enabled
      true,    -- pix_enabled
      true,    -- credit_card_enabled
      true,    -- whatsapp_notifications_enabled
      NULL,    -- whatsapp_phone_number
      false,   -- email_notifications_enabled
      true,    -- loyalty_enabled
      0.1,     -- loyalty_points_percentage
      50,      -- loyalty_minimum_order
      true,    -- is_active
      false,   -- is_maintenance
      NULL     -- maintenance_message
    )
    RETURNING * INTO v_settings;
  END IF;

  -- STEP 3: Retornar dados (novos ou existentes)
  RETURN QUERY SELECT * FROM tenant_settings WHERE id = v_settings.id;
END;
$$;

-- 🟢 FUNCTION 2: upsert_tenant_settings()
-- Garante existence de tenant_settings
-- Depois faz UPDATE com campos fornecidos
-- Dispara realtime sync automaticamente
CREATE OR REPLACE FUNCTION upsert_tenant_settings(
  p_tenant_id UUID,
  p_updates JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  meia_meia_enabled BOOLEAN,
  imagens_enabled BOOLEAN,
  adicionais_enabled BOOLEAN,
  bebidas_enabled BOOLEAN,
  bordas_enabled BOOLEAN,
  free_ingredients_enabled BOOLEAN,
  free_ingredients_max INTEGER,
  store_name VARCHAR,
  store_description TEXT,
  store_logo_url VARCHAR,
  primary_color VARCHAR,
  secondary_color VARCHAR,
  timezone VARCHAR,
  store_opens_at TIME,
  store_closes_at TIME,
  average_delivery_minutes INTEGER,
  mercadopago_enabled BOOLEAN,
  pix_enabled BOOLEAN,
  credit_card_enabled BOOLEAN,
  whatsapp_notifications_enabled BOOLEAN,
  whatsapp_phone_number VARCHAR,
  email_notifications_enabled BOOLEAN,
  loyalty_enabled BOOLEAN,
  loyalty_points_percentage NUMERIC,
  loyalty_minimum_order NUMERIC,
  is_active BOOLEAN,
  is_maintenance BOOLEAN,
  maintenance_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update_sql TEXT;
  v_set_clause TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- STEP 1: Garantir que existe (criar se não existir)
  PERFORM ensure_tenant_settings(p_tenant_id);

  -- STEP 2: Se updates vazio, só retorna dados
  IF p_updates IS NULL OR p_updates = '{}'::JSONB THEN
    RETURN QUERY SELECT * FROM tenant_settings WHERE tenant_id = p_tenant_id;
    RETURN;
  END IF;

  -- STEP 3: Construir SQL de UPDATE dinamicamente
  -- Só para campos que existem no JSONB
  v_set_clause := '';
  FOR v_key, v_value IN 
    SELECT key, (value #>> '{}')
    FROM jsonb_each(p_updates)
  LOOP
    IF v_set_clause != '' THEN
      v_set_clause := v_set_clause || ', ';
    END IF;
    
    -- Verificar tipo e formatar corretamente
    IF v_value IN ('true', 'false') THEN
      v_set_clause := v_set_clause || v_key || ' = ' || v_value::BOOLEAN;
    ELSIF v_value ~ '^\d+$' THEN
      v_set_clause := v_set_clause || v_key || ' = ' || v_value::NUMERIC;
    ELSE
      v_set_clause := v_set_clause || v_key || ' = ' || quote_literal(v_value);
    END IF;
  END LOOP;

  -- STEP 4: Executar UPDATE
  IF v_set_clause != '' THEN
    v_update_sql := 'UPDATE tenant_settings SET ' || v_set_clause || ', updated_at = NOW() WHERE tenant_id = $1';
    EXECUTE v_update_sql USING p_tenant_id;
  END IF;

  -- STEP 5: Retornar dados atualizados
  RETURN QUERY SELECT * FROM tenant_settings WHERE tenant_id = p_tenant_id;
END;
$$;

-- 🟢 GRANT permissões para RPC functions
GRANT EXECUTE ON FUNCTION ensure_tenant_settings(UUID) 
TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION upsert_tenant_settings(UUID, JSONB)
TO authenticated, anon, service_role;

-- ✅ VERIFICAÇÃO
SELECT 'migration_20260331_auto_create_tenant_settings: OK' as status;
