-- Adicionar campos de desconto de cupom à tabela orders
-- Esta migration permite rastrear descontos de cupom nos pedidos

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_coupon VARCHAR(100);

-- Criar índices para facilitar consultas
CREATE INDEX IF NOT EXISTS idx_orders_coupon_discount ON orders(coupon_discount);
CREATE INDEX IF NOT EXISTS idx_orders_applied_coupon ON orders(applied_coupon);

-- Adicionar comentários para documentação
COMMENT ON COLUMN orders.coupon_discount IS 'Desconto em R$ aplicado através de cupom promocional';
COMMENT ON COLUMN orders.applied_coupon IS 'Código do cupom promocional aplicado neste pedido';
