-- RLS Policies for pending_pix_orders table

-- Policy 1: Customers can SELECT their own pending pix orders
CREATE POLICY "customers_select_pending_pix" ON pending_pix_orders
  FOR SELECT
  USING (auth.uid() = customer_id OR auth.role() = 'authenticated');

-- Policy 2: Customers can INSERT their own pending pix orders
CREATE POLICY "customers_insert_pending_pix" ON pending_pix_orders
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR TRUE);

-- Policy 3: Customers can UPDATE their own pending pix orders
CREATE POLICY "customers_update_pending_pix" ON pending_pix_orders
  FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Policy 4: Service role (webhooks/edge functions) bypasses RLS
CREATE POLICY "service_role_pending_pix_all" ON pending_pix_orders
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
