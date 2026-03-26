-- Corrigir RLS Policies para suportar fluxos reais do app
-- 1. Guest checkout (customer_id = NULL inicialmente), 2. Webhooks via service_role

-- =====================================================================
-- ORDERS TABLE - Policies corrigidas
-- =====================================================================

-- Policy 1: SELECT - Clientes leem seus próprios pedidos OU service_role
DROP POLICY IF EXISTS "customers_select_own_orders" ON orders;
CREATE POLICY "customers_select_own_orders" ON orders
  FOR SELECT
  USING (
    -- Service role sempre acessa
    auth.role() = 'service_role' 
    -- OU cliente autenticado vê seus pedidos
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_id)
    -- OU qualquer um (anônimo ou autenticado) lê se não tiver customer_id ainda (guest checkout)
    OR customer_id IS NULL
  );

-- Policy 2: INSERT - Guest checkout permitido + service_role
DROP POLICY IF EXISTS "customers_insert_orders" ON orders;
CREATE POLICY "customers_insert_orders" ON orders
  FOR INSERT
  WITH CHECK (
    -- Service role sempre insere
    auth.role() = 'service_role'
    -- Qualquer um (autenticado ou não) pode inserir - será populado pelo trigger
    OR TRUE
  );

-- Policy 3: UPDATE - Clientes atualizam seus próprios + service_role para webhooks
DROP POLICY IF EXISTS "customers_update_own_orders" ON orders;
CREATE POLICY "customers_update_own_orders" ON orders
  FOR UPDATE
  USING (
    -- Service role sempre (webhooks de pagamento)
    auth.role() = 'service_role'
    -- OU cliente autenticado atualiza seu próprio
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_id)
  )
  WITH CHECK (
    -- Same USING conditions
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_id)
  );

-- =====================================================================
-- ORDER_ITEMS TABLE - Policies corrigidas
-- =====================================================================

-- Policy 1: SELECT - Vinculado aos pedidos do usuário
DROP POLICY IF EXISTS "customers_select_order_items" ON order_items;
CREATE POLICY "customers_select_order_items" ON order_items
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR order_id IN (
      SELECT id FROM orders 
      WHERE 
        auth.uid() = customer_id 
        OR customer_id IS NULL  -- Guest orders
    )
  );

-- Policy 2: INSERT - Guest checkout
DROP POLICY IF EXISTS "customers_insert_order_items" ON order_items;
CREATE POLICY "customers_insert_order_items" ON order_items
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    -- Allow any insert for guest checkout
    OR TRUE
  );

-- Policy 3: UPDATE - Mostly service_role (webhooks)
DROP POLICY IF EXISTS "service_role_update_order_items" ON order_items;
CREATE POLICY "service_role_update_order_items" ON order_items
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- PENDING_PIX_ORDERS TABLE - Policies corrigidas
-- =====================================================================

-- Policy 1: SELECT - Clientes veem seus próprios + service_role
DROP POLICY IF EXISTS "customers_select_pending_pix" ON pending_pix_orders;
CREATE POLICY "customers_select_pending_pix" ON pending_pix_orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    -- Cliente autenticado vê seu PIX pendente
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_id)
    -- OU qualquer um vê se customer_id = NULL (anônimo)
    OR customer_id IS NULL
  );

-- Policy 2: INSERT - Guest checkout permitido
DROP POLICY IF EXISTS "customers_insert_pending_pix" ON pending_pix_orders;
CREATE POLICY "customers_insert_pending_pix" ON pending_pix_orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR TRUE  -- Allow guest checkout
  );

-- Policy 3: UPDATE - Service_role only (webhooks atualizam status)
DROP POLICY IF EXISTS "service_role_update_pending_pix" ON pending_pix_orders;
CREATE POLICY "service_role_update_pending_pix" ON pending_pix_orders
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: DELETE - Service_role only
DROP POLICY IF EXISTS "service_role_delete_pending_pix" ON pending_pix_orders;
CREATE POLICY "service_role_delete_pending_pix" ON pending_pix_orders
  FOR DELETE
  USING (auth.role() = 'service_role');

-- =====================================================================
-- SETTINGS TABLE - Já está ok, apenas clarificar
-- =====================================================================

-- Policy 1: SELECT - Todos leem
DROP POLICY IF EXISTS "anyone_read_settings" ON settings;
CREATE POLICY "anyone_read_settings" ON settings
  FOR SELECT
  USING (TRUE);

-- Policy 2-4: Só service_role modifica
DROP POLICY IF EXISTS "service_role_insert_settings" ON settings;
CREATE POLICY "service_role_insert_settings" ON settings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_update_settings" ON settings;
CREATE POLICY "service_role_update_settings" ON settings
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_delete_settings" ON settings;
CREATE POLICY "service_role_delete_settings" ON settings
  FOR DELETE
  USING (auth.role() = 'service_role');
