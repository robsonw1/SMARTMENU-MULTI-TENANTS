import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendResetPasswordEmailRequest {
  email: string;
  new_password: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Resend API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as SendResetPasswordEmailRequest;
    const { email, new_password } = body;

    console.log(`📧 [RESET-EMAIL] Enviando email de recuperação para: ${email}`);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.5; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #FF6B35; margin-bottom: 10px; }
        .brand { color: #666; font-size: 14px; margin-bottom: 20px; }
        .content { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
        .credentials { background: #f0f0f0; padding: 15px; border-left: 4px solid #FF6B35; margin: 20px 0; border-radius: 4px; }
        .credential-label { font-weight: bold; color: #666; margin-top: 10px; }
        .credential-value { font-family: monospace; background: white; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 14px; word-break: break-all; }
        .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
        .warning { background: #fff3cd; border-left: 4px solid #FFB400; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔵 AEZap SmartMenu</div>
            <div class="brand">Sua plataforma de pedidos online</div>
        </div>

        <div class="content">
            <h2>Recuperação de Senha</h2>
            
            <p>Recebemos uma solicitação para recuperar sua senha. Aqui está sua nova senha de acesso:</p>

            <div class="credentials">
                <div class="credential-label">Email:</div>
                <div class="credential-value">${email}</div>

                <div class="credential-label">Nova Senha:</div>
                <div class="credential-value">${new_password}</div>
            </div>

            <p style="margin: 20px 0; text-align: center;">
                <a href="https://smartmenu.app.aezap.site/admin" class="button">Ir para o Painel</a>
            </p>

            <div class="warning">
                <strong>🔒 Segurança:</strong> Se você não solicitou a recuperação de senha, ignore este email. Sua conta permanece segura.
            </div>

            <div class="warning">
                <strong>💡 Dica:</strong> Você pode alterar sua senha a qualquer momento em "Configurações > Alterar Senha" dentro do painel administrativo.
            </div>
        </div>

        <div class="footer">
            <p>© 2026 AEZap SmartMenu. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`;

    console.log(`🚀 Enviando email via Resend...`);
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AEZap SmartMenu <noreply@smartmenu.aezap.site>',
        to: email,
        subject: 'Recuperação de Senha - AEZap SmartMenu',
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();
    console.log(`📥 Resend Response (${resendResponse.status}):`, resendData);

    if (!resendResponse.ok) {
      console.error(`❌ Resend API Error:`, resendData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Email send failed: ${resendData?.message || 'Unknown error'}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Email de recuperação enviado com sucesso! Email ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email de recuperação enviado com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send reset password email error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
