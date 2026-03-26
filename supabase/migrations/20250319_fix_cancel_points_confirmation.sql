-- Fix: Track points earned when confirmed and reverse on cancellation
-- Problema: Quando pagamento é confirmado, pontos são movidos para total_points
-- mas não há registro do quanto foi movido. Ao cancelar, não consegue reverter.

-- Adicionar coluna para rastrear pontos que foram movidos
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS points_earned_from_this_order INTEGER DEFAULT 0;

COMMENT ON COLUMN public.orders.points_earned_from_this_order IS 
'Stores the amount of points that were earned and moved to customer total_points when payment was confirmed. Used to reverse them if order is cancelled.';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_orders_points_earned ON public.orders(points_earned_from_this_order) 
WHERE points_earned_from_this_order > 0;

-- Atualizar trigger de reversão para lidar com pontos confirmados
CREATE OR REPLACE FUNCTION fn_reverse_points_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_points INTEGER;
  v_customer_id UUID;
  v_points_redeemed INTEGER;
  v_points_earned_confirmed INTEGER;
  v_order_id TEXT;
BEGIN
  -- If order is being cancelled from any confirmed/pending status
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending', 'preparing', 'delivering') THEN
    v_customer_id := NEW.customer_id;
    v_pending_points := COALESCE(OLD.pending_points, 0);
    v_points_redeemed := COALESCE(OLD.points_redeemed, 0);
    v_points_earned_confirmed := COALESCE(OLD.points_earned_from_this_order, 0);
    v_order_id := NEW.id;
    
    -- 🔧 FIX: Se customer_id for NULL, buscar por customer_email
    IF v_customer_id IS NULL AND NEW.customer_email IS NOT NULL THEN
      SELECT id INTO v_customer_id FROM public.customers 
      WHERE email = NEW.customer_email 
      LIMIT 1;
      RAISE LOG '[CANCEL] 🔍 Customer ID buscado por email: %', v_customer_id;
    END IF;
    
    RAISE LOG '[CANCEL] 🔴 === INICIANDO REVERSÃO DE PONTOS PARA PEDIDO % ===', v_order_id;
    RAISE LOG '[CANCEL] pendingPoints=%  pointsRedeemed=% pointsEarned=%  customerID=%', v_pending_points, v_points_redeemed, v_points_earned_confirmed, v_customer_id;
    
    -- 1️⃣ SE CLIENTE USOU PONTOS (pointsRedeemed > 0): RESTAURAR OS PONTOS
    IF v_points_redeemed > 0 AND v_customer_id IS NOT NULL THEN
      BEGIN
        UPDATE public.customers
        SET total_points = total_points + v_points_redeemed
        WHERE id = v_customer_id;
        
        INSERT INTO public.loyalty_transactions (
          customer_id, 
          order_id,
          points_earned, 
          transaction_type, 
          description, 
          created_at
        )
        VALUES (
          v_customer_id,
          v_order_id,
          v_points_redeemed,
          'cancellation_reversal',
          concat('Cancelamento do pedido ', v_order_id, ' - Restauração de ', v_points_redeemed, ' pontos resgatados'),
          NOW()
        );
        
        RAISE LOG '[CANCEL] ✅ PONTOS RESTAURADOS para cliente %: +% pontos devolvidos', v_customer_id, v_points_redeemed;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[CANCEL] ❌ ERRO ao restaurar pontos: %', SQLERRM;
      END;
    END IF;
    
    -- 2️⃣ SE CLIENTE GANHOU E MOVEU PONTOS (pointsEarned > 0): REVERTER DO TOTAL
    -- Este é o novo cenário: pagamento foi confirmado e pontos já foram adicionados a total_points
    IF v_points_earned_confirmed > 0 AND v_customer_id IS NOT NULL THEN
      BEGIN
        UPDATE public.customers
        SET total_points = GREATEST(0, total_points - v_points_earned_confirmed)
        WHERE id = v_customer_id;
        
        INSERT INTO public.loyalty_transactions (
          customer_id, 
          order_id,
          points_spent, 
          transaction_type, 
          description, 
          created_at
        )
        VALUES (
          v_customer_id,
          v_order_id,
          v_points_earned_confirmed,
          'cancellation_reversal',
          concat('Cancelamento do pedido ', v_order_id, ' - Reversão de ', v_points_earned_confirmed, ' pontos ganhos na compra'),
          NOW()
        );
        
        RAISE LOG '[CANCEL] ✅ PONTOS GANHOS REVERTIDOS para cliente %: -% pontos removidos do saldo', v_customer_id, v_points_earned_confirmed;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[CANCEL] ❌ ERRO ao reverter pontos ganhos: %', SQLERRM;
      END;
    END IF;
    
    -- 3️⃣ SE CLIENTE GANHARIA PONTOS (pendingPoints > 0): REMOVER OS PONTOS PENDENTES
    IF v_pending_points > 0 AND v_customer_id IS NOT NULL THEN
      BEGIN
        -- NÃO subtrair do total_points pois pending_points ainda não foram movidos
        -- Apenas registrar que estos pontos foram cancelados
        INSERT INTO public.loyalty_transactions (
          customer_id, 
          order_id,
          points_spent, 
          transaction_type, 
          description, 
          created_at
        )
        VALUES (
          v_customer_id,
          v_order_id,
          v_pending_points,
          'cancellation_reversal',
          concat('Cancelamento do pedido ', v_order_id, ' - Remoção de ', v_pending_points, ' pontos pendentes não ganhos'),
          NOW()
        );
        
        RAISE LOG '[CANCEL] ✅ PONTOS PENDENTES REMOVIDOS do pedido %: -%  pontos descartados', v_order_id, v_pending_points;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[CANCEL] ❌ ERRO ao remover pending_points: %', SQLERRM;
      END;
    END IF;
    
    -- 4️⃣ LIMPAR CAMPOS DE PONTOS NO PEDIDO
    NEW.pending_points := 0;
    NEW.points_earned_from_this_order := 0;
    RAISE LOG '[CANCEL] ✅ Status atualizado para cancelled e processos completados para pedido %', v_order_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger com a nova função
DROP TRIGGER IF EXISTS trg_reverse_points_on_cancel ON public.orders;
CREATE TRIGGER trg_reverse_points_on_cancel
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION fn_reverse_points_on_cancel();

COMMENT ON FUNCTION fn_reverse_points_on_cancel() IS 
'Automatically reverses loyalty points when an order is cancelled.
Works for all payment methods (PIX, Card, Cash).
Handles three cases:
1. If points_redeemed > 0: restores them to customer total_points (customer paid with points discount)
2. If points_earned_from_this_order > 0: subtracts from total_points (order was confirmed and points were added)
3. If pending_points > 0: records them as cancelled (prevents earning points on cancelled purchase)
This ensures points integrity and prevents fraud.';
