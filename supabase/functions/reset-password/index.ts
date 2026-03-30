import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  email: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Gerar nova senha padrão
function generateNewPassword(): string {
  const randomNumber = Math.floor(Math.random() * 9999) + 1000; // 1000-9999
  return `nova-${randomNumber}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as ResetPasswordRequest;
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Email is required' 
        } as ResetPasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`🔐 [RESET-PASSWORD] Solicitação de recuperação: ${email}`);

    // Buscar usuário com este email
    const { data: users, error: searchError } = await supabase.auth.admin.listUsers({
      filters: `email:"${email.toLowerCase().trim()}"`,
    });

    if (searchError || !users || !users.users || users.users.length === 0) {
      console.log(`⚠️ [RESET-PASSWORD] Email não encontrado: ${email}`);
      // Por segurança, contar a mesma história mesmo se não existir
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Se o email está registrado, você receberá uma nova senha em breve.',
        } as ResetPasswordResponse),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const user = users.users[0];
    const newPassword = generateNewPassword();

    console.log(`✅ [RESET-PASSWORD] Usuário encontrado: ${user.id}`);

    // Atualizar senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      console.error(`❌ [RESET-PASSWORD] Erro ao atualizar senha:`, updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro ao atualizar senha. Tente novamente mais tarde.',
        } as ResetPasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`🔄 [RESET-PASSWORD] Senha atualizada para: ${newPassword}`);

    // Enviar email com nova senha
    try {
      await supabase.functions.invoke('send-reset-password-email', {
        body: {
          email: email.toLowerCase().trim(),
          new_password: newPassword,
        },
      });
      console.log(`📧 [RESET-PASSWORD] Email de recuperação enviado`);
    } catch (emailError) {
      console.error(`⚠️ [RESET-PASSWORD] Erro ao enviar email:`, emailError);
      // Continua mesmo se email falhar - senha foi atualizada
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Nova senha foi enviada para seu email',
      } as ResetPasswordResponse),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recuperar senha'
      } as ResetPasswordResponse),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
