import { serve } from 'https://deno.land/std@0.187.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

interface RequestBody {
  tenantId: string;
  updates: Record<string, any>;
}

// ✅ CORS headers completos para todas as respostas
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req: Request) => {
  // ✅ Responder preflight request imediatamente
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔐 [UPDATE-SETTINGS-FUNCTION] Iniciando atualização de settings via Edge Function');

    const { tenantId, updates }: RequestBody = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'updates object is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ CRÍTICO: ID é agora tenant-specific
    const settingsId = `settings_${tenantId}`;

    console.log(`📝 [UPDATE-SETTINGS-FUNCTION] Atualizando settings para tenant: ${tenantId}`);
    console.log(`📝 [UPDATE-SETTINGS-FUNCTION] Settings ID: ${settingsId}`);
    console.log(`📝 [UPDATE-SETTINGS-FUNCTION] Updates:`, updates);

    // ✅ NOVO: Spread inteligente - ler valor ANTERIOR para preservar campos (como store_logo_url)
    // Se updates.value vem (é o JSONB novo), fazer merge com o actual para não perder dados
    let mergedUpdates = { ...updates };
    
    // Se há atualização de value (JSONB), ler o valor anterior primeiro
    if (updates.value) {
      console.log('🔄 [UPDATE-SETTINGS-FUNCTION] Atualização de value detectada - fazendo spread inteligente...');
      
      const { data: currentRow, error: readError } = await supabase
        .from('settings')
        .select('value')
        .eq('id', settingsId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!readError && currentRow?.value) {
        // ✅ MERGE: Preservar campos do valor anterior + aplicar novos
        // Isso garante que store_logo_url não é perdido!
        mergedUpdates.value = {
          ...(currentRow.value || {}),  // Campos antigos (incluindo store_logo_url)
          ...updates.value,              // Novos campos sobrescrevem antigos se explícitos
        };
        console.log('✅ [UPDATE-SETTINGS-FUNCTION] Value merged com sucesso');
        console.log('✅ [UPDATE-SETTINGS-FUNCTION] store_logo_url preservada:', mergedUpdates.value.store_logo_url);
      } else if (readError) {
        console.warn('⚠️  [UPDATE-SETTINGS-FUNCTION] Não conseguiu ler valor anterior (pode ser primeira criação):', readError);
        // Se não conseguir ler (primeira vez), usa o value que veio
      }
    }

    // ✅ Service role: sem RLS restrictions
    const { data, error } = await supabase
      .from('settings')
      .update({
        ...mergedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settingsId)
      .eq('tenant_id', tenantId)  // ✅ Double-check isolamento
      .select()
      .single();

    if (error) {
      console.error('❌ [UPDATE-SETTINGS-FUNCTION] Erro ao atualizar:', error);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [UPDATE-SETTINGS-FUNCTION] Settings atualizadas com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        message: 'Settings atualizadas com sucesso' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌ [UPDATE-SETTINGS-FUNCTION] Exceção:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
