import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as crypto from "https://deno.land/std/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTenantRequest {
  establishment_name: string;
  email: string;
  phone: string;
}

interface CreateTenantResponse {
  success: boolean;
  message: string;
  tenant_id?: string;
  login_url?: string;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const appUrl = Deno.env.get('VITE_APP_URL') || 'https://app.aezap.site';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as CreateTenantRequest;
    const { establishment_name, email, phone } = body;

    console.log(`
╔════════════════════════════════════════╗
║  🚀 CREATE TENANT (Multi-tenant SaaS)  ║
╠════════════════════════════════════════╣
║  Nome:  ${establishment_name}
║  Email: ${email}
║  Phone: ${phone}
╚════════════════════════════════════════╝
`);

    // ✅ 1. Validar dados
    if (!establishment_name || !email || !phone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: establishment_name, email, phone' 
        } as CreateTenantResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 2. Gerar slug único do tenant
    const slug = establishment_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .slice(0, 50);

    const uniqueSlug = `${slug}-${Date.now().toString(36)}`.slice(0, 100);
    console.log(`📝 Generated slug: ${uniqueSlug}`);

    // ✅ 3. Gerar senha aleatória (16 caracteres)
    const passwordBytes = crypto.getRandomValues(new Uint8Array(12));
    const passwordArray = Array.from(passwordBytes);
    const password = passwordArray
      .map(byte => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
        return chars[byte % chars.length];
      })
      .join('')
      .slice(0, 16);

    console.log(`🔑 Generated temporary password (length: ${password.length})`);

    // ✅ 4. Criar tenant no banco
    console.log(`💾 Criando tenant no banco...`);
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: establishment_name,
        slug: uniqueSlug,
        email: email,
        phone: phone,
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error(`❌ Erro ao criar tenant:`, tenantError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create tenant: ${tenantError?.message}` 
        } as CreateTenantResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Tenant criado: ID=${newTenant.id}, slug=${newTenant.slug}`);

    // ✅ 5. tenant_settings já será criado automaticamente pelo trigger SQL

    // ✅ 6. Criar usuário autenticado no Supabase Auth
    console.log(`👤 Criando usuário no Auth...`);
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        tenant_id: newTenant.id,
        establishment_name: establishment_name,
      },
    });

    if (authError || !user) {
      console.error(`❌ Erro ao criar auth user:`, authError);
      // Deletar tenant se auth falhar
      await supabase.from('tenants').delete().eq('id', newTenant.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create user: ${authError?.message}` 
        } as CreateTenantResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Usuário Auth criado: ${user.id}`);

    // ✅ 7. Atualizar tenant com user_id
    await supabase
      .from('tenants')
      .update({ owner_id: user.id })
      .eq('id', newTenant.id);

    // ✅ 8. Adicionar admin_users entry
    console.log(`🔐 Criando admin_users entry...`);
    const { error: adminError } = await supabase
      .from('admin_users')
      .insert({
        id: user.id,
        email: email,
        role: 'owner',
      });

    if (adminError) {
      console.warn(`⚠️  Aviso ao criar admin_users:`, adminError);
    } else {
      console.log(`✅ Admin entry criado`);
    }

    // ✅ 9. Popular dados padrão (produtos, bairros, etc)
    console.log(`📦 Populando dados padrão...`);
    
    // Produtos padrão (pizzas genéricas)
    const defaultProducts = [
      {
        name: "Pizza Margherita",
        data: {
          description: "Molho de tomate, mussarela e manjericão fresco",
          price: 35.00,
          category: "tradicionais",
          is_active: true,
        },
      },
      {
        name: "Pizza Pepperoni",
        data: {
          description: "Molho de tomate, mussarela e pepperoni",
          price: 38.00,
          category: "tradicionais",
          is_active: true,
        },
      },
      {
        name: "Pizza Frango com Catupiry",
        data: {
          description: "Frango cozido e Catupiry derretido",
          price: 42.00,
          category: "premium",
          is_active: true,
        },
      },
    ];

    for (const product of defaultProducts) {
      await supabase
        .from('products')
        .insert({
          name: product.name,
          data: product.data,
          tenant_id: newTenant.id,
        });
    }

    console.log(`✅ Produtos padrão inseridos`);

    // Bairros padrão
    const defaultNeighborhoods = [
      { name: "Centro", delivery_fee: 5.00, distance_km: 2.0, active: true },
      { name: "Zona Norte", delivery_fee: 7.00, distance_km: 4.0, active: true },
      { name: "Zona Sul", delivery_fee: 7.00, distance_km: 4.0, active: true },
    ];

    for (const neighborhood of defaultNeighborhoods) {
      await supabase
        .from('neighborhoods')
        .insert({
          ...neighborhood,
          tenant_id: newTenant.id,
        });
    }

    console.log(`✅ Bairros padrão inseridos`);

    // ✅ 10. Gerar link de acesso
    const loginUrl = `${appUrl.replace(/\/$/, '')}/${uniqueSlug}-app.aezap.site`;
    
    console.log(`
╔════════════════════════════════════════╗
║  ✅ TENANT CRIADO COM SUCESSO!         ║
╠════════════════════════════════════════╣
║  Tenant ID: ${newTenant.id}
║  Slug:      ${uniqueSlug}
║  URL:       ${loginUrl}
║  Email:     ${email}
║  Password:  [gerada automaticamente]
╚════════════════════════════════════════╝
`);

    // ✅ 11. Disparar função de envio de email (Resend)
    console.log(`💌 Disparando envio de email automático...`);
    
    // Executar send-welcome-email de forma assíncrona (fire and forget)
    fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        tenant_id: newTenant.id,
        email: email,
        establishment_name: establishment_name,
        temporary_password: password,
        login_url: loginUrl,
      }),
    }).catch((err) => {
      console.warn(`⚠️  Falha ao disparar send-welcome-email:`, err);
    });

    console.log(`📧 Email de boas-vindas será enviado em background`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tenant created successfully! Check your email for login details.',
        tenant_id: newTenant.id,
        login_url: loginUrl,
      } as CreateTenantResponse),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message 
      } as CreateTenantResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
