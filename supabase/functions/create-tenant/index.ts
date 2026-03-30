import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTenantRequest {
  name?: string;
  slug?: string;
  establishment_name?: string;
  email?: string;
  phone?: string;
}

interface CreateTenantResponse {
  success: boolean;
  tenant?: any;
  admin_user?: any;
  default_password?: string;
  login_url?: string;
  error?: string;
}

// Gerar senha padrão baseada em slug + número aleatório
// Garante unicidade mesmo com nomes de loja iguais
function generateDefaultPassword(slug: string): string {
  const randomNumber = Math.floor(Math.random() * 9999) + 1000; // 1000-9999
  return `${slug}-${randomNumber}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as CreateTenantRequest;
    
    let name = body.name || body.establishment_name;
    let slug = body.slug;
    const email = body.email;
    const phone = body.phone;

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name or establishment_name is required' } as CreateTenantResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!slug) {
      slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Could not generate valid slug' } as CreateTenantResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verificar se slug já existe
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug.toLowerCase().trim())
      .single();

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: 'Slug already exists' } as CreateTenantResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ✅ OPÇÃO 1: Verificar se email já existe em auth.users ANTES de criar tenant
    if (email) {
      try {
        const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers({
          filters: `email:"${email.toLowerCase().trim()}"`,
        });

        if (!checkError && existingUser && existingUser.users && existingUser.users.length > 0) {
          console.log(`⚠️ Email já existe em auth.users: ${email}`);
          return new Response(
            JSON.stringify({ 
              error: 'Email already registered',
              message: 'Este email já está registrado no sistema. Use outro email ou recupere seu acesso clicando em "Esqueci minha senha".',
              code: 'email_exists',
            } as CreateTenantResponse),
            { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      } catch (err) {
        console.error('Error checking existing user:', err);
        // Continuar mesmo se check falhar - deixar Supabase validar depois
      }
    }

    // Inserir novo tenant
    const { data: newTenant, error: insertError } = await supabase
      .from('tenants')
      .insert([
        {
          name: name.trim(),
          slug: slug.toLowerCase().trim(),
          timezone: 'America/Sao_Paulo',
          contact_email: email || null,
          contact_phone: phone || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message } as CreateTenantResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Se email foi fornecido, criar usuário admin
    let adminUser = null;
    let defaultPassword = null;

    // 🔐 PRIORIDADE 1: Criar auth.users + admin_users PRIMEIRO (bloqueante)
    // Isso garante que login funciona IMEDIATAMENTE após cadastro
    if (email) {
      defaultPassword = generateDefaultPassword(slug.toLowerCase().trim());
      console.log(`🔐 [PRIORITY-1] Criando usuário admin com senha: ${defaultPassword}`);

      // Criar usuário no auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: defaultPassword,
        email_confirm: true, // Auto-confirmar para cliente poder fazer login
      });

      if (authError) {
        console.error('❌ Auth creation error:', authError);
        return new Response(
          JSON.stringify({ 
            error: `Erro ao criar usuário admin: ${authError.message}`,
            details: authError 
          } as CreateTenantResponse),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!authUser?.user) {
        console.error('❌ Auth user not returned');
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao criar usuário - resposta inválida do Supabase',
          } as CreateTenantResponse),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      console.log(`✅ [PRIORITY-1] Usuário criado: ${authUser.user.id}`);

      // Inserir em admin_users vinculado ao tenant
      const { data: createdAdminUser, error: adminUserError } = await supabase
        .from('admin_users')
        .insert([
          {
            id: authUser.user.id,
            tenant_id: newTenant.id,
            email: email.toLowerCase().trim(),
            role: 'owner',
            is_active: true,
          },
        ])
        .select()
        .single();

      if (adminUserError) {
        console.error('❌ Admin user creation error:', adminUserError);
        return new Response(
          JSON.stringify({ 
            error: `Erro ao vincular admin às lojas: ${adminUserError.message}`,
          } as CreateTenantResponse),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      adminUser = createdAdminUser;
      console.log(`✅ [PRIORITY-1] Admin vinculado ao tenant: ${adminUser.id}`);
    }

    // 🎁 PRIORIDADE 2: Criar settings em PARALELO (fire-and-forget)
    // Não bloqueia o fluxo - usar Promise.then() sem await
    // Triggers automáticos também podem criar, isso é fallback
    const createSettingsAsync = async () => {
      try {
        const settingsId = `settings_${newTenant.id}`;
        console.log(`⏱️ [ASYNC-SETTINGS] Iniciando criação de settings para tenant: ${newTenant.id}`);
        
        const { error: settingsError } = await supabase
          .from('settings')
          .insert([
            {
              id: settingsId,
              tenant_id: newTenant.id,
              key: 'tenant_default',
              value: { initialized: true, initialized_at: new Date().toISOString() },
              is_manually_open: true,
              enable_scheduling: false,
              min_schedule_minutes: 30,
              max_schedule_days: 7,
              print_mode: 'auto',
              auto_print_pix: false,
              auto_print_card: false,
              auto_print_cash: false,
              allow_scheduling_on_closed_days: false,
              allow_scheduling_outside_business_hours: false,
              allow_same_day_scheduling_outside_hours: false,
              respect_business_hours_for_scheduling: true,
            },
          ]);

        if (settingsError) {
          console.warn(`⚠️ [ASYNC-SETTINGS] Settings creation warning (não bloqueante): ${settingsError.message}`);
        } else {
          console.log(`✅ [ASYNC-SETTINGS] Registro de settings criado para tenant: ${newTenant.id}`);
        }
      } catch (settingsErr) {
        console.error(`⚠️ [ASYNC-SETTINGS] Erro ao criar settings (não bloqueante):`, settingsErr);
      }
    };

    // Iniciar promise em paralelo (NÃO ESPERAR)
    createSettingsAsync().catch(err => console.error('[ASYNC-SETTINGS] Unhandled error:', err));

    // 📧 PRIORIDADE 3: Enviar email com credenciais
    // Só após auth estar 100% pronto
    if (email && defaultPassword) {
      try {
        console.log(`📧 [EMAIL] Disparando welcome email para: ${email}`);
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            tenant_id: newTenant.id,
            email: email,
            establishment_name: name,
            default_password: defaultPassword,
            login_url: `https://${newTenant.slug}.app.aezap.site/admin`,
          },
        });
        console.log(`✅ [EMAIL] Welcome email enviado com sucesso`);
      } catch (emailError) {
        console.error('⚠️ [EMAIL] Email sending error (não bloqueante):', emailError);
        // Continuar mesmo se email falhar
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant: newTenant,
        admin_user: adminUser,
        default_password: defaultPassword,
        login_url: `https://${newTenant.slug}.app.aezap.site/admin`,
      } as CreateTenantResponse),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      } as CreateTenantResponse),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
