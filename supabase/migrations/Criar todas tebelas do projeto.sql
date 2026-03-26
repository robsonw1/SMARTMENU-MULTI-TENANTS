-- Complete Schema for Pizzaria Forneiro Eden
-- All tables with proper columns, constraints, and indexes

-- Complete Schema for Pizzaria Forneiro Eden
-- 1. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text UNIQUE NOT NULL,
  total_points integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  total_purchases integer DEFAULT 0,
  received_signup_bonus boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  reference text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  zip_code text NOT NULL,
  delivery_type text NOT NULL,
  delivery_fee numeric DEFAULT 0,
  payment_method text NOT NULL,
  subtotal numeric NOT NULL,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  payment_status text,
  payment_confirmed_at timestamp with time zone,
  scheduled_for timestamp with time zone,
  printed_at timestamp with time zone
);

-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  size text,
  price numeric NOT NULL,
  total_price numeric NOT NULL,
  custom_ingredients jsonb,
  paid_ingredients jsonb,
  item_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  price numeric,
  price_small numeric,
  price_large numeric,
  image text,
  is_popular boolean DEFAULT false,
  is_new boolean DEFAULT false,
  is_vegetarian boolean DEFAULT false,
  is_active boolean DEFAULT true,
  is_customizable boolean DEFAULT false,
  data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. LOYALTY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  points_earned integer DEFAULT 0,
  points_spent integer DEFAULT 0,
  transaction_type text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

-- 6. LOYALTY COUPONS TABLE
CREATE TABLE IF NOT EXISTS loyalty_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_amount numeric,
  discount_percentage numeric,
  max_uses integer,
  current_uses integer DEFAULT 0,
  is_used boolean DEFAULT false,
  used_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

-- 7. LOYALTY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_real numeric DEFAULT 1,
  points_expiration_days integer DEFAULT 365,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 8. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printnode_printer_id text,
  print_mode text DEFAULT 'automatic',
  auto_print_pix boolean DEFAULT true,
  auto_print_card boolean DEFAULT true,
  auto_print_cash boolean DEFAULT true,
  max_schedule_days integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 9. NEIGHBORHOODS TABLE
CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  delivery_fee numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 10. SCHEDULING SLOTS TABLE
CREATE TABLE IF NOT EXISTS scheduling_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time time NOT NULL,
  current_orders integer DEFAULT 0,
  max_orders integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(date, time)
);

-- 11. PENDING PIX ORDERS TABLE
CREATE TABLE IF NOT EXISTS pending_pix_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text UNIQUE NOT NULL,
  order_payload jsonb NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  confirmed_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- 12. TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  mercadopago_access_token text,
  mercadopago_refresh_token text,
  mercadopago_user_id text,
  mercadopago_merchant_account_id text,
  mercadopago_oauth_state text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 13. WHATSAPP INSTANCES TABLE
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id text UNIQUE NOT NULL,
  qr_code text,
  status text NOT NULL DEFAULT 'disconnected',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 14. WHATSAPP STATUS MESSAGES TABLE
CREATE TABLE IF NOT EXISTS whatsapp_status_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  message_template text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 15. WHATSAPP NOTIFICATION LOGS TABLE
CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);

-- 16. LEGACY TABLES (for migration purposes - may be deprecated)
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_slots_date_time ON scheduling_slots(date, time);
CREATE INDEX IF NOT EXISTS idx_pending_pix_orders_status ON pending_pix_orders(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_id ON whatsapp_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Enable RLS (Row Level Security) for production
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_pix_orders ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO authenticated;
GRANT SELECT ON products TO authenticated;
GRANT SELECT, INSERT ON loyalty_transactions TO authenticated;
GRANT SELECT ON loyalty_coupons TO authenticated;
GRANT SELECT ON loyalty_settings TO authenticated;
GRANT SELECT ON settings TO authenticated;
GRANT SELECT ON neighborhoods TO authenticated;
GRANT SELECT ON scheduling_slots TO authenticated;
GRANT SELECT, INSERT ON pending_pix_orders TO authenticated;
GRANT SELECT ON whatsapp_status_messages TO authenticated;
