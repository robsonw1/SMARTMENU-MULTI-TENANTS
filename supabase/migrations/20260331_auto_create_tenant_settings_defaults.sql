-- ============================================================
-- SOLUÇÃO: Auto-Create tenant_settings com Defaults
-- Data: 31/03/2026
-- Objetivo: Se tenant_settings não existe, criar com defaults
-- Strategy: UPSERT automático + Fallback local no hook
-- ============================================================

-- 🟢 STEP 1: Criar FUNCTION que retorna tenant_settings
-- Se não existe, cria com defaults
-- Se existe, retorna dados atuais
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
  free_ingredients_max INT,
  store_name TEXT,
  store_description TEXT,
  store_logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  timezone TEXT,
  store_opens_at TEXT,
  store_closes_at TEXT,
  average_delivery_minutes INT,
  mercadopago_enabled BOOLEAN,
  pix_enabled BOOLEAN,
  credit_card_enabled BOOLEAN,
  whatsapp_notifications_enabled BOOLEAN,
  whatsapp_phone_number TEXT,
  email_notifications_enabled BOOLEAN,
  loyalty_enabled BOOLEAN,
  loyalty_points_percentage NUMERIC,
  loyalty_minimum_order NUMERIC,
  is_active BOOLEAN,
  is_maintenance BOOLEAN,
  maintenance_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings tenant_settings;
BEGIN
  -- Verificar se já existe
  SELECT * INTO v_settings FROM tenant_settings WHERE tenant_id = p_tenant_id LIMIT 1;
  
  IF v_settings.id IS NULL THEN
    -- Criar novo com defaults
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
      true,           -- meia_meia_enabled
      true,           -- imagens_enabled
      true,           -- adicionais_enabled
      true,           -- bebidas_enabled
      true,           -- bordas_enabled
      false,          -- free_ingredients_enabled
      6,              -- free_ingredients_max
      'Sua Loja',     -- store_name
      'Bem-vindo!',   -- store_description
      NULL,           -- store_logo_url
      '#FF6B35',      -- primary_color
      '#F7931E',      -- secondary_color
      'America/Sao_Paulo', -- timezone
      '10:00',        -- store_opens_at
      '22:00',        -- store_closes_at
      30,             -- average_delivery_minutes
      false,          -- mercadopago_enabled
      true,           -- pix_enabled
      true,           -- credit_card_enabled
      true,           -- whatsapp_notifications_enabled
      NULL,           -- whatsapp_phone_number
      false,          -- email_notifications_enabled
      true,           -- loyalty_enabled
      0.1,            -- loyalty_points_percentage
      50,             -- loyalty_minimum_order
      true,           -- is_active
      false,          -- is_maintenance
      NULL            -- maintenance_message
    )
    RETURNING * INTO v_settings;
    
    RAISE NOTICE 'Nova configuração de loja criada para tenant: %', p_tenant_id;
  END IF;
  
  RETURN QUERY SELECT
    v_settings.id,
    v_settings.tenant_id,
    v_settings.meia_meia_enabled,
    v_settings.imagens_enabled,
    v_settings.adicionais_enabled,
    v_settings.bebidas_enabled,
    v_settings.bordas_enabled,
    v_settings.free_ingredients_enabled,
    v_settings.free_ingredients_max,
    v_settings.store_name,
    v_settings.store_description,
    v_settings.store_logo_url,
    v_settings.primary_color,
    v_settings.secondary_color,
    v_settings.timezone,
    v_settings.store_opens_at,
    v_settings.store_closes_at,
    v_settings.average_delivery_minutes,
    v_settings.mercadopago_enabled,
    v_settings.pix_enabled,
    v_settings.credit_card_enabled,
    v_settings.whatsapp_notifications_enabled,
    v_settings.whatsapp_phone_number,
    v_settings.email_notifications_enabled,
    v_settings.loyalty_enabled,
    v_settings.loyalty_points_percentage,
    v_settings.loyalty_minimum_order,
    v_settings.is_active,
    v_settings.is_maintenance,
    v_settings.maintenance_message,
    v_settings.created_at,
    v_settings.updated_at;
END;
$$;

-- Dar permissão para autenticados chamar
GRANT EXECUTE ON FUNCTION ensure_tenant_settings(UUID) 
TO authenticated, anon, service_role;

-- ============================================================
-- STEP 2: Criar FUNCTION para UPSERT (ao salvar)
-- Garante que UPDATE será bem-sucedido mesmo que INSERT ainda não existisse
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_tenant_settings(
  p_tenant_id UUID,
  p_updates JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  updated_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Primeiro: Garantir que o registro existe (via ensure_tenant_settings)
  PERFORM ensure_tenant_settings(p_tenant_id);
  
  -- Segundo: Fazer o UPDATE
  UPDATE tenant_settings 
  SET 
    (
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
      maintenance_message,
      updated_at
    ) = (
      COALESCE((p_updates->>'meia_meia_enabled')::boolean, meia_meia_enabled),
      COALESCE((p_updates->>'imagens_enabled')::boolean, imagens_enabled),
      COALESCE((p_updates->>'adicionais_enabled')::boolean, adicionais_enabled),
      COALESCE((p_updates->>'bebidas_enabled')::boolean, bebidas_enabled),
      COALESCE((p_updates->>'bordas_enabled')::boolean, bordas_enabled),
      COALESCE((p_updates->>'free_ingredients_enabled')::boolean, free_ingredients_enabled),
      COALESCE((p_updates->>'free_ingredients_max')::integer, free_ingredients_max),
      COALESCE(p_updates->>'store_name', store_name),
      COALESCE(p_updates->>'store_description', store_description),
      COALESCE(p_updates->>'store_logo_url', store_logo_url),
      COALESCE(p_updates->>'primary_color', primary_color),
      COALESCE(p_updates->>'secondary_color', secondary_color),
      COALESCE(p_updates->>'timezone', timezone),
      COALESCE(p_updates->>'store_opens_at', store_opens_at),
      COALESCE(p_updates->>'store_closes_at', store_closes_at),
      COALESCE((p_updates->>'average_delivery_minutes')::integer, average_delivery_minutes),
      COALESCE((p_updates->>'mercadopago_enabled')::boolean, mercadopago_enabled),
      COALESCE((p_updates->>'pix_enabled')::boolean, pix_enabled),
      COALESCE((p_updates->>'credit_card_enabled')::boolean, credit_card_enabled),
      COALESCE((p_updates->>'whatsapp_notifications_enabled')::boolean, whatsapp_notifications_enabled),
      COALESCE(p_updates->>'whatsapp_phone_number', whatsapp_phone_number),
      COALESCE((p_updates->>'email_notifications_enabled')::boolean, email_notifications_enabled),
      COALESCE((p_updates->>'loyalty_enabled')::boolean, loyalty_enabled),
      COALESCE((p_updates->>'loyalty_points_percentage')::numeric, loyalty_points_percentage),
      COALESCE((p_updates->>'loyalty_minimum_order')::numeric, loyalty_minimum_order),
      COALESCE((p_updates->>'is_active')::boolean, is_active),
      COALESCE((p_updates->>'is_maintenance')::boolean, is_maintenance),
      COALESCE(p_updates->>'maintenance_message', maintenance_message),
      NOW()
    )
  WHERE tenant_id = p_tenant_id
  RETURNING tenant_settings.id, tenant_settings.tenant_id, tenant_settings.updated_at
  INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Erro ao atualizar tenant_settings para tenant %', p_tenant_id;
  END IF;
  
  RETURN QUERY SELECT v_result.id, v_result.tenant_id, v_result.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_tenant_settings(UUID, JSONB) 
TO authenticated, anon, service_role;

-- ============================================================
-- VERIFICAÇÃO
SELECT 'Funções criadas com sucesso' as status;
