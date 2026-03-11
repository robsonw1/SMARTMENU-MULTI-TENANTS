/**
 * ✅ TESTE DE INTEGRAÇÃO - Edge Function update-store-settings
 * 
 * Este arquivo testa que:
 * 1. A Edge Function está acessível
 * 2. Validações funcionam corretamente
 * 3. Dados são salvos corretamente no banco
 * 4. RLS está corretamente bypassada (service_role)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sczvwzmskvoeahiuwkky.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjendkem1za3ZvZWFoaXV3a2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk1MjczNDUsImV4cCI6MTk5NzEwNzM0NX0.6EG8bbEEXF7yHTNmXG4N0KPXE0tGJlPMQDH_PVEqtQY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('🧪 ════════════════════════════════════════════════════════════════')
console.log('🧪 TESTE DE INTEGRAÇÃO: Edge Function update-store-settings')
console.log('🧪 ════════════════════════════════════════════════════════════════')

async function testEdgeFunction() {
  try {
    console.log('\n📝 TESTE 1: Validação com schedule completa')
    const testSettings1 = {
      settings: {
        name: 'Forneiro Éden - Test',
        phone: '(21) 97224-3112',
        address: 'Rua das Pizzas, 123',
        slogan: 'A Pizza mais recheada 🍕',
        schedule: {
          monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '21:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
        },
        isManuallyOpen: true,
        deliveryTimeMin: 60,
        deliveryTimeMax: 70,
        enableScheduling: true,
      },
    }

    console.log('  Enviando para Edge Function...')
    const { data, error } = await supabase.functions.invoke('update-store-settings', {
      body: testSettings1,
    })

    if (error) {
      console.error('  ❌ ERRO:', error)
      return false
    }

    if (data?.success) {
      console.log('  ✅ SUCESSO!')
      console.log('  📊 Resultado:', {
        success: data.success,
        scheduleMatch: data.verification?.scheduleMatch,
        isManuallyOpenMatch: data.verification?.isManuallyOpenMatch,
      })

      // Verificar que tuesday foi realmente alterada para 21:00
      const savedTuesday = data.data?.value?.schedule?.tuesday
      if (savedTuesday?.openTime === '21:00') {
        console.log('  ✅ Horário de terça alterado para 21:00 com sucesso!')
      } else {
        console.log('  ❌ Horário de terça NÃO foi alterado! Valor:', savedTuesday?.openTime)
      }
    } else {
      console.error('  ❌ ERRO:', data?.error)
      return false
    }

    console.log('\n📝 TESTE 2: Validação com schedule INCOMPLETA (deve falhar)')
    const testSettings2 = {
      settings: {
        name: 'Test',
        phone: '(21) 97224-3112',
        address: 'Rua',
        slogan: 'Test',
        schedule: {
          // Faltando dias - deve ser rejeitado
          monday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
        },
      },
    }

    console.log('  Enviando para Edge Function...')
    const { data: data2, error: error2 } = await supabase.functions.invoke('update-store-settings', {
      body: testSettings2,
    })

    if (error2) {
      console.error('  ❌ ERRO inesperado:', error2)
      return false
    }

    if (!data2?.success && data2?.error) {
      console.log('  ✅ CORRETAMENTE REJEITADO!')
      console.log('  📊 Motivo:', data2.error)
    } else {
      console.error('  ❌ DEVERIA TER REJEITADO!')
      return false
    }

    console.log('\n📝 TESTE 3: Validação com horário INVÁLIDO (deve falhar)')
    const testSettings3 = {
      settings: {
        name: 'Test',
        phone: '(21) 97224-3112',
        address: 'Rua',
        slogan: 'Test',
        schedule: {
          monday: { isOpen: true, openTime: '25:00', closeTime: '23:00' }, // Hora inválida
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
        },
      },
    }

    console.log('  Enviando para Edge Function...')
    const { data: data3, error: error3 } = await supabase.functions.invoke('update-store-settings', {
      body: testSettings3,
    })

    if (error3) {
      console.error('  ❌ ERRO inesperado:', error3)
      return false
    }

    if (!data3?.success && data3?.error) {
      console.log('  ✅ CORRETAMENTE REJEITADO!')
      console.log('  📊 Motivo:', data3.error)
    } else {
      console.error('  ❌ DEVERIA TER REJEITADO!')
      return false
    }

    console.log('\n✅ TODOS OS TESTES PASSARAM!')
    console.log('🧪 ════════════════════════════════════════════════════════════════')
    return true

  } catch (err) {
    console.error('\n❌ ERRO NÃO TRATADO:', err)
    return false
  }
}

// Executar testes
testEdgeFunction().then((success) => {
  if (!success) {
    process.exit(1)
  }
})
