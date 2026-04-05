import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'X-Content-Type-Options': 'nosniff',
};

// 🔧 Função para extrair tenant_id do hostname
function getTenantFromHostname(hostname: string): string | null {
  // Formatos suportados:
  // - {tenant}.app.aezap.site
  // - forneiro-eden-app.aezap.site (id único)
  
  const parts = hostname.split('.');
  
  if (parts.length >= 3) {
    // Pegar a primeira parte antes de .app.aezap.site
    const tenant = parts[0];
    
    // UUID format ou slug simples
    if (tenant.match(/^[a-z0-9-]+$/)) {
      return tenant;
    }
  }
  
  return null;
}

// 🔒 Validar tenant_id (UUID ou slug)
function isValidTenantId(tenantId: string): boolean {
  if (!tenantId) return false;
  // UUID: 36 chars com hífens, ou slug: 3-50 chars alphanumeric com hífen
  return tenantId.match(/^([a-f0-9-]{36}|[a-z0-9-]{3,50})$/i) !== null;
}

// 🧹 Sanitizar para atributos HTML
function sanitizeForHtml(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .substring(0, 256)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// 🔗 Validar URL para og:image
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return false;
    
    // Suportar extensões comuns
    const pathname = urlObj.pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(pathname) || pathname.endsWith('.png');
  } catch {
    return false;
  }
}

// 📋 Base HTML template (sem meta tags que mudam)
const HTML_TEMPLATE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>{{TITLE}}</title>
    <meta name="description" content="{{DESCRIPTION}}" />
    <meta name="author" content="{{AUTHOR}}" />

    <!-- PWA Essentials -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#ff9500" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="{{SHORT_NAME}}" />
    <link rel="apple-touch-icon" href="{{LOGO_URL}}" />
    <link rel="icon" type="image/png" href="{{LOGO_URL}}" />

    <!-- Open Graph Meta Tags para WhatsApp e redes sociais -->
    <meta property="og:title" content="{{OG_TITLE}}" />
    <meta property="og:description" content="{{OG_DESCRIPTION}}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="{{OG_IMAGE}}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="{{OG_IMAGE_ALT}}" />
    <meta property="og:url" content="{{OG_URL}}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{TWITTER_TITLE}}" />
    <meta name="twitter:description" content="{{TWITTER_DESCRIPTION}}" />
    <meta name="twitter:image" content="{{OG_IMAGE}}" />
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

// 🎯 Construir URL completa da requisição (para og:url)
function buildCurrentUrl(req: Request): string {
  try {
    const url = new URL(req.url);
    // Substituir protocolo de função por https
    return `https://${url.host}${url.pathname}${url.search}`;
  } catch {
    return 'https://app.aezap.site/';
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Apenas GET / HEAD permitidos
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // 1️⃣ Extrair tenant_id do hostname
    let tenantId = url.searchParams.get('tenant_id');
    
    if (!tenantId) {
      tenantId = getTenantFromHostname(url.hostname);
    }

    if (!tenantId || !isValidTenantId(tenantId)) {
      console.log('⚠️ Invalid or missing tenant_id:', tenantId);
      // Retornar template base sem customização
      const html = HTML_TEMPLATE
        .replace(/{{TITLE}}/g, 'Pizzaria Forneiro Eden - Cardápio Digital')
        .replace(/{{DESCRIPTION}}/g, '🔵Cardápio digital. Peça sua pizza deliciosa online 🇮🇹')
        .replace(/{{AUTHOR}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{SHORT_NAME}}/g, 'Forneiro Eden')
        .replace(/{{LOGO_URL}}/g, '/logo-192.png')
        .replace(/{{OG_TITLE}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{OG_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹')
        .replace(/{{OG_IMAGE}}/g, 'https://forneiro-eden-app.aezap.site/logo-512.png')
        .replace(/{{OG_IMAGE_ALT}}/g, 'Pizzaria Forneiro Eden Logo')
        .replace(/{{OG_URL}}/g, buildCurrentUrl(req))
        .replace(/{{TWITTER_TITLE}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{TWITTER_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹');

      return new Response(html, { headers: corsHeaders });
    }

    // 2️⃣ Query settings no Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || ''
    );

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('id', `settings_${tenantId}`)
      .single();

    if (settingsError || !settings) {
      console.warn('⚠️ Settings not found for tenant:', tenantId, settingsError);
      // Usar valores padrão
      const html = HTML_TEMPLATE
        .replace(/{{TITLE}}/g, 'Pizzaria Forneiro Eden - Cardápio Digital')
        .replace(/{{DESCRIPTION}}/g, '🔵Cardápio digital. Peça sua pizza deliciosa online 🇮🇹')
        .replace(/{{AUTHOR}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{SHORT_NAME}}/g, 'Forneiro Eden')
        .replace(/{{LOGO_URL}}/g, '/logo-192.png')
        .replace(/{{OG_TITLE}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{OG_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹')
        .replace(/{{OG_IMAGE}}/g, 'https://forneiro-eden-app.aezap.site/logo-512.png')
        .replace(/{{OG_IMAGE_ALT}}/g, 'Pizzaria Forneiro Eden Logo')
        .replace(/{{OG_URL}}/g, buildCurrentUrl(req))
        .replace(/{{TWITTER_TITLE}}/g, 'Pizzaria Forneiro Eden')
        .replace(/{{TWITTER_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹');

      return new Response(html, { headers: corsHeaders });
    }

    // 3️⃣ Extrair valores do settings
    const settingsValue = settings.value || {};
    const storeName = sanitizeForHtml(settingsValue.name || 'Pizzaria Forneiro Eden');
    const storeDescription = sanitizeForHtml(settingsValue.description || '🔵Cardápio digital. Peça sua pizza deliciosa online 🇮🇹');
    const shortName = sanitizeForHtml((storeName.split(' ')[0] || 'Forneiro Eden').substring(0, 12));
    
    // 🖼️ Logo URL com fallback
    let logoUrl = settingsValue.store_logo_url || '';
    const validatedLogoUrl = isValidImageUrl(logoUrl) ? logoUrl : '/logo-512.png';
    
    // 📊 Construir meta tags
    const title = `${storeName} - Cardápio Digital`;
    const description = `🔵${storeDescription}`;
    const ogTitle = storeName;
    const ogDescription = `📱Peça seu pedido online agora - ${storeDescription}`;
    const ogImage = validatedLogoUrl;
    const ogImageAlt = `Logo ${storeName}`;
    const currentUrl = buildCurrentUrl(req);

    console.log(`✅ Render HTML para tenant: ${tenantId}`);
    console.log(`📱 Store: ${storeName}`);
    console.log(`🖼️  Logo: ${ogImage}`);

    // 4️⃣ Substituir placeholders no template
    const html = HTML_TEMPLATE
      .replace(/{{TITLE}}/g, title)
      .replace(/{{DESCRIPTION}}/g, description)
      .replace(/{{AUTHOR}}/g, storeName)
      .replace(/{{SHORT_NAME}}/g, shortName)
      .replace(/{{LOGO_URL}}/g, ogImage)
      .replace(/{{OG_TITLE}}/g, ogTitle)
      .replace(/{{OG_DESCRIPTION}}/g, ogDescription)
      .replace(/{{OG_IMAGE}}/g, ogImage)
      .replace(/{{OG_IMAGE_ALT}}/g, ogImageAlt)
      .replace(/{{OG_URL}}/g, currentUrl)
      .replace(/{{TWITTER_TITLE}}/g, ogTitle)
      .replace(/{{TWITTER_DESCRIPTION}}/g, ogDescription);

    // 5️⃣ Para HEAD requests, não enviar body (apenas headers)
    if (req.method === 'HEAD') {
      return new Response(null, { headers: corsHeaders });
    }

    return new Response(html, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error in render-html:', error);
    
    // Fallback seguro
    const fallback = HTML_TEMPLATE
      .replace(/{{TITLE}}/g, 'Pizzaria Forneiro Eden - Cardápio Digital')
      .replace(/{{DESCRIPTION}}/g, '🔵Cardápio digital. Peça sua pizza deliciosa online 🇮🇹')
      .replace(/{{AUTHOR}}/g, 'Pizzaria Forneiro Eden')
      .replace(/{{SHORT_NAME}}/g, 'Forneiro Eden')
      .replace(/{{LOGO_URL}}/g, '/logo-192.png')
      .replace(/{{OG_TITLE}}/g, 'Pizzaria Forneiro Eden')
      .replace(/{{OG_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹')
      .replace(/{{OG_IMAGE}}/g, 'https://forneiro-eden-app.aezap.site/logo-512.png')
      .replace(/{{OG_IMAGE_ALT}}/g, 'Pizzaria Forneiro Eden Logo')
      .replace(/{{OG_URL}}/g, 'https://app.aezap.site/')
      .replace(/{{TWITTER_TITLE}}/g, 'Pizzaria Forneiro Eden')
      .replace(/{{TWITTER_DESCRIPTION}}/g, '🔵Cardápio digital - Peça sua pizza deliciosa agora 🇮🇹');

    return new Response(fallback, { headers: corsHeaders });
  }
});
