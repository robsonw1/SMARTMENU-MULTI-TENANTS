-- Migration: Garantir que settings existem com schedule COMPLETO

-- 1️⃣ Se não existe a row, criar com todos os 7 dias de schedule
INSERT INTO public.settings (id, key, value, is_manually_open, updated_at)
VALUES (
  'store-settings',
  'store_config',
  jsonb_build_object(
    'name', 'Forneiro Éden',
    'phone', '(11) 99999-9999',
    'address', 'Rua das Pizzas, 123 - Centro',
    'slogan', 'A Pizza mais recheada da cidade 🇮🇹',
    'schedule', jsonb_build_object(
      'monday', jsonb_build_object('isOpen', false, 'openTime', '18:00', 'closeTime', '23:00'),
      'tuesday', jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00'),
      'wednesday', jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00'),
      'thursday', jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00'),
      'friday', jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00'),
      'saturday', jsonb_build_object('isOpen', true, 'openTime', '17:00', 'closeTime', '00:00'),
      'sunday', jsonb_build_object('isOpen', true, 'openTime', '17:00', 'closeTime', '23:00')
    ),
    'deliveryTimeMin', 60,
    'deliveryTimeMax', 70,
    'pickupTimeMin', 40,
    'pickupTimeMax', 50,
    'isManuallyOpen', true,
    'orderAlertEnabled', true,
    'sendOrderSummaryToWhatsApp', false
  ),
  true,
  NOW()
)
ON CONFLICT (id) 
-- Se já existe, fazer NADA (preservar dados existentes)
DO NOTHING;

-- 2️⃣ Se já existe mas schedule está vazio ou incompleto, CORRIGIR
UPDATE public.settings
SET value = jsonb_set(
  value,
  '{schedule}',
  COALESCE(value->'schedule', '{}'::jsonb) || jsonb_build_object(
    'monday', COALESCE((value->'schedule'->>'monday')::jsonb, jsonb_build_object('isOpen', false, 'openTime', '18:00', 'closeTime', '23:00')),
    'tuesday', COALESCE((value->'schedule'->>'tuesday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00')),
    'wednesday', COALESCE((value->'schedule'->>'wednesday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00')),
    'thursday', COALESCE((value->'schedule'->>'thursday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00')),
    'friday', COALESCE((value->'schedule'->>'friday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '18:00', 'closeTime', '23:00')),
    'saturday', COALESCE((value->'schedule'->>'saturday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '17:00', 'closeTime', '00:00')),
    'sunday', COALESCE((value->'schedule'->>'sunday')::jsonb, jsonb_build_object('isOpen', true, 'openTime', '17:00', 'closeTime', '23:00'))
  )
),
updated_at = NOW()
WHERE id = 'store-settings';

-- 3️⃣ Verificar resultado final
SELECT 
  id,
  value->'schedule' as schedule_final,
  jsonb_object_keys(value->'schedule') as dias_presentes,
  updated_at
FROM public.settings 
WHERE id = 'store-settings';
