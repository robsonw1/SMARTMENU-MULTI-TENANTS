-- Adicionar coluna auto_confirmed_by_pix à tabela orders
-- Rastreia se o pedido foi auto-confirmado pelo webhook do Mercado Pago

ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_confirmed_by_pix BOOLEAN DEFAULT FALSE;

-- Criar índice para facilitar consultas
CREATE INDEX IF NOT EXISTS idx_orders_auto_confirmed_pix ON orders(auto_confirmed_by_pix);

-- Adicionar comentário para documentação
COMMENT ON COLUMN orders.auto_confirmed_by_pix IS 'Indica se o pedido foi automaticamente confirmado pelo webhook de PIX aprovado';
