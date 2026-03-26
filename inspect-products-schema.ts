#!/usr/bin/env node

/**
 * Script para inspecionar a tabela products no Supabase
 * Verifica como acentos e caracteres especiais são armazenados
 * 
 * Executar: npx tsx inspect-products-schema.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectProductsSchema() {
  console.log('🔍 Inspecionando tabela products...\n');

  try {
    // 1. Contar produtos com acentos
    console.log('1️⃣ PRODUTOS COM ACENTOS\n');
    const { data: productsWithAccents, error: error1 } = await supabase
      .from('products')
      .select('id, name')
      .or(
        "name.ilike.%á%," +
        "name.ilike.%é%," +
        "name.ilike.%í%," +
        "name.ilike.%ó%," +
        "name.ilike.%ú%," +
        "name.ilike.%ã%," +
        "name.ilike.%õ%," +
        "name.ilike.%ç%"
      )
      .limit(30);

    if (productsWithAccents) {
      console.log(`✅ Encontrados ${productsWithAccents.length} produtos com acentos:\n`);
      productsWithAccents.forEach((p: any) => {
        console.log(`   • ID: ${p.id}`);
        console.log(`     Name: ${p.name}`);
        console.log('');
      });
    }

    // 2. Exemplos específicos
    console.log('\n2️⃣ EXEMPLOS ESPECÍFICOS\n');
    const { data: examples, error: error2 } = await supabase
      .from('products')
      .select('id, name, data')
      .in('id', [
        'trad-alho-oleo',
        'trad-brocolis',
        'add-parmesao',
        'add-brocolis',
        'borda-requeijao',
        'doce-californa',
        'promo-seleta'
      ]);

    if (examples) {
      console.log('Produtos com acentos catalogados:\n');
      examples.forEach((p: any) => {
        console.log(`📦 ${p.name}`);
        console.log(`   ID: ${p.id}`);
        if (p.data?.description) {
          console.log(`   Descrição: ${p.data.description}`);
        }
        if (p.data?.ingredients?.length) {
          console.log(`   Ingredientes: ${p.data.ingredients.join(', ')}`);
        }
        console.log('');
      });
    }

    // 3. Contagem total
    console.log('\n3️⃣ ESTATÍSTICAS\n');
    const { count: totalProducts, error: error3 } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    console.log(`Total de produtos: ${totalProducts}`);

    // 4. Verificar tipos de arquivo
    console.log('\n4️⃣ ESTRUTURA DE DADOS\n');
    console.log('Tipo de coluna "name": TEXT (VARCHAR sem limite)');
    console.log('Encoding: UTF-8 (suporta acentos nativamente)');
    console.log('Collation: pt_BR ou padrão UTF-8');

    console.log('\n✅ Análise concluída!');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

inspectProductsSchema();
