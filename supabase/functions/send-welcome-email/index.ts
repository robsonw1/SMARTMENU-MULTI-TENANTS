import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWelcomeEmailRequest {
  tenant_id: string;
  email: string;
  establishment_name: string;
  temporary_password: string;
  login_url: string;
}

serve(async (req: Request) => {
  // Handle CORS
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

    const body = await req.json() as SendWelcomeEmailRequest;
    const { tenant_id, email, establishment_name, temporary_password, login_url } = body;

    console.log(`
╔════════════════════════════════════════╗
║  📧 ENVIAR EMAIL BOAS-VINDAS            ║
╠════════════════════════════════════════╣
║  Tenant:  ${tenant_id}
║  Para:    ${email}
║  Loja:    ${establishment_name}
╚════════════════════════════════════════╝
`);

    // Construir HTML do email
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
        .feature-list { list-style: none; padding: 0; }
        .feature-list li { padding: 8px 0; color: #555; }
        .feature-list li:before { content: "✓ "; color: #FF6B35; font-weight: bold; margin-right: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🍕 AEZap SmartMenu</div>
            <div class="brand">Sua plataforma de pedidos online</div>
        </div>

        <div class="content">
            <h2>Bem-vindo, ${establishment_name}!</h2>
            
            <p>Sua loja online foi criada com sucesso! Aqui estão suas credenciais de acesso:</p>

            <div class="credentials">
                <div class="credential-label">Email:</div>
                <div class="credential-value">${email}</div>

                <div class="credential-label">Senha Temporária:</div>
                <div class="credential-value">${temporary_password}</div>

                <div class="credential-label">Link de Acesso:</div>
                <div class="credential-value">${login_url}</div>
            </div>

            <p style="margin: 20px 0; text-align: center;">
                <a href="${login_url}" class="button">Acessar seu Painel</a>
            </p>

            <h3>O que você pode fazer agora:</h3>
            <ul class="feature-list">
                <li>Personalizar informações da sua loja</li>
                <li>Editar cardápio e preços</li>
                <li>Definir horários de funcionamento</li>
                <li>Gerenciar áreas de entrega</li>
                <li>Ativar/desativar recursos (meia-meia, adicionais, etc)</li>
                <li>Configurar notificações por WhatsApp</li>
                <li>Ver análise de pedidos e faturamento</li>
            </ul>

            <h3>Próximos Passos:</h3>
            <ol>
                <li>Acesse o link acima com suas credenciais</li>
                <li>Altere sua senha em "Configurações"</li>
                <li>Customize as informações da sua loja</li>
                <li>Ative seu cardápio padrão ou importe o seu</li>
                <li>Configure WhatsApp para notificações automáticas</li>
                <li>Ative sua loja e comece a receber pedidos!</li>
            </ol>

            <div style="background: #fff3cd; border-left: 4px solid #FFB400; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <strong>⚠️ Importante:</strong> Sua senha é temporária. Por favor, altere-a no primeiro acesso em "Configurações > Alterar Senha".
            </div>

            <p style="color: #666; font-size: 14px;">
                Tem dúvidas? Consulte nossa documentação ou entre em contato com nossa equipe de suporte.
            </p>
        </div>

        <div class="footer">
            <p>© 2026 AEZap SmartMenu. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`;

    // Enviar com Resend
    console.log(`🚀 Enviando email via Resend...`);
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AEZap SmartMenu <noreply@aezap.site>',
        to: email,
        subject: `Bem-vindo ao AEZap SmartMenu - ${establishment_name}`,
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

    console.log(`✅ Email enviado com sucesso! Email ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Welcome email sent successfully',
        email_id: resendData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
