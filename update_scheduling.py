#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Ler o arquivo
with open('src/components/SchedulingCheckoutModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Procurar a linha onde inserir
target = "console.log('✅ [CHECKOUT] Pedido criado com ID:', createdOrder.id, 'Tenant:', tenantId || 'será auto-detectado');"
polling_call = "\n\n    // ⚡ POLLING AGRESSIVO: Detectar novo pedido agendado em tempo real (COM PROTEÇÃO)\n    if (forceAggressivePolling && typeof forceAggressivePolling === 'function') {\n      try {\n        forceAggressivePolling();\n      } catch (error) {\n        console.warn('[SCHEDULING-CHECKOUT] ⚠️ Erro ao iniciar polling:', error);\n      }\n    }"

if target in content:
    # Inserir polling logo após o console.log
    updated_content = content.replace(target, target + polling_call)
    
    # Escrever de volta
    with open('src/components/SchedulingCheckoutModal.tsx', 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print('✅ SchedulingCheckoutModal.tsx atualizado com sucesso!')
else:
    print('❌ Padrão não encontrado no arquivo')
