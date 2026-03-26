-- Add tenant_id column to products table
ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Create index for tenant_id
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
