import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteInstanceRequest {
  instance_id: string;
  evolution_instance_name: string;
  tenant_id: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: DeleteInstanceRequest;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('❌ Parse error:', parseErr);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { instance_id, evolution_instance_name, tenant_id } = body;
    console.log(`🗑️ [DELETE] Received:`, { instance_id, evolution_instance_name, tenant_id });
    console.log(`📝 Instance name value: "${evolution_instance_name}" (length: ${evolution_instance_name.length})`);
    console.log(`📝 Instance name type: ${typeof evolution_instance_name}`);

    if (!instance_id || !evolution_instance_name || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tenant
    const { data: tenantExists } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id);
    
    if (!tenantExists || tenantExists.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tenant not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionUrl || !evolutionKey) {
      console.error('❌ Missing Evolution credentials');
      return new Response(
        JSON.stringify({ success: false, message: 'Evolution API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/$/, '');
    
    console.log(`🗑️ Deletando instância: ${evolution_instance_name}`);
    console.log(`📍 Evolution API URL: ${baseUrl}`);
    console.log(`🔑 API Key present: ${!!evolutionKey}`);
    console.log(`📝 Instance name: "${evolution_instance_name}"`);
    
    // Endpoint correto conforme documentação da Evolution API
    // DELETE /instance/delete/{instance}
    const deleteUrl = `${baseUrl}/instance/delete/${evolution_instance_name}`;
    console.log(`\n🔗 DELETE ${deleteUrl}`);
    
    let instanceDeleted = false;
    let deletionError: any = null;
    
    try {
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'apikey': evolutionKey || '',
          'Content-Type': 'application/json',
        },
      });
      
      const responseData = deleteResponse.status === 204 ? null : await deleteResponse.json().catch(() => null);
      console.log(`📥 Status: ${deleteResponse.status}`);
      console.log(`📥 Response:`, responseData);
      
      if (deleteResponse.status === 200 || deleteResponse.status === 204) {
        instanceDeleted = true;
        console.log(`✅ Instance deleted successfully on Evolution API`);
      } else {
        deletionError = responseData;
        console.error(`❌ Evolution API error (status ${deleteResponse.status}):`, responseData);
      }
    } catch (err) {
      console.error(`❌ Fetch error:`, err);
      deletionError = err;
    }
    
    console.log(`\n📊 Evolution API deletion result: ${instanceDeleted ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // ⚠️ IMPORTANTE: Deletar do Supabase mesmo se Evolution falhar
    // Assim o gerente consegue "limpar" o painel admin mesmo se houver erro na Evolution API
    console.log('💾 Deletando configuração de instância do banco de dados...');
    const { error: deleteErr } = await supabase
      .from('whatsapp_instances')
      .delete()
      .eq('id', instance_id)
      .eq('tenant_id', tenant_id);

    if (deleteErr) {
      console.error('❌ DB error ao deletar:', deleteErr);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to delete instance from database',
          error: deleteErr
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Instance fully deleted (Supabase + Evolution attempt)`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Instance deleted successfully',
        evolutionDeleted: instanceDeleted,
        supabaseDeleted: true,
        note: !instanceDeleted ? 'Instance removed from Supabase, but Evolution API deletion failed. Check Evolution API status.' : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Unexpected error occurred',
        error: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
