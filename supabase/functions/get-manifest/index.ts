import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate', // ✅ Disable caching - always fresh
};

// ✅ Sanitizar strings para JSON safety
function sanitizeForJson(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[\x00-\x1F]/g, '')
    .substring(0, 512)
    .trim();
}

// ✅ Validar URL
function isValidUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// ✅ Detectar se é UUID ou slug
function isUUID(str: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(str);
}

// ✅ Buscar tenant_id pelo slug
async function getTenantIdBySlug(supabase: any, slug: string): Promise<string | null> {
  try {
    console.log(`🔍 [MANIFEST] Buscando tenant_id para slug: ${slug}`);
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error || !tenant?.id) {
      console.warn(`⚠️ [MANIFEST] Slug não encontrado: ${slug}`);
      return null;
    }

    console.log(`✅ [MANIFEST] Slug resolvido para tenant_id: ${tenant.id}`);
    return tenant.id;
  } catch (error) {
    console.error(`❌ [MANIFEST] Erro ao buscar slug:`, error);
    return null;
  }
}

// ✅ Fallback manifest padrão
function getFallbackManifest(): any {
  return {
    "name": "Pizzaria Forneiro Eden",
    "short_name": "Forneiro Eden",
    "description": "🔵Cardápio digital e pedidos online",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#000000",
    "theme_color": "#ff9500",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "/logo-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/logo-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any"
      }
    ]
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use GET.' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const url = new URL(req.url);
    let tenantIdOrSlug = url.searchParams.get('tenant_id');
    
    console.log(`\n🔍 [GET-MANIFEST] STARTED`);
    console.log(`📍 Tenant param: ${tenantIdOrSlug}`);
    
    if (!tenantIdOrSlug || tenantIdOrSlug.trim() === '') {
      console.log('⚠️ [MANIFEST] No tenant_id provided');
      return new Response(
        JSON.stringify({ error: 'tenant_id or slug required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || ''
    );

    // Se é slug (não UUID), fazer lookup
    let tenantId = tenantIdOrSlug;
    if (!isUUID(tenantIdOrSlug)) {
      console.log(`🔄 [MANIFEST] Slug detected: ${tenantIdOrSlug}, doing lookup...`);
      const resolved = await getTenantIdBySlug(supabase, tenantIdOrSlug);
      if (!resolved) {
        console.warn(`❌ [MANIFEST] Slug lookup FAILED: ${tenantIdOrSlug}`);
        console.log(`↪️ Returning fallback manifest`);
        return new Response(
          JSON.stringify(getFallbackManifest()),
          { status: 200, headers: corsHeaders }
        );
      }
      tenantId = resolved;
      console.log(`✅ [MANIFEST] Slug resolved to tenant_id: ${tenantId}`);
    }

    // Fetch settings para este tenant (tabela settings, não tenant_settings)
    const settingsId = `settings_${tenantId}`;
    console.log(`📋 [MANIFEST] Fetching settings: ${settingsId}`);
    
    const { data: settingsRow, error } = await supabase
      .from('settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', settingsId)
      .single();

    if (error) {
      console.error(`❌ [MANIFEST] Settings fetch ERROR:`, {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      console.log(`↪️ Returning fallback manifest`);
      return new Response(
        JSON.stringify(getFallbackManifest()),
        { status: 200, headers: corsHeaders }
      );
    }

    if (!settingsRow) {
      console.warn(`⚠️ [MANIFEST] Settings not found for: ${tenantId}`);
      console.log(`↪️ Returning fallback manifest`);
      return new Response(
        JSON.stringify(getFallbackManifest()),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`✅ [MANIFEST] Settings found:`, {
      id: settingsRow.id,
      tenant_id: settingsRow.tenant_id,
      hasValue: !!settingsRow.value,
    });

    // ✅ Extrair dados de value (jsonb) como faz useSettingsStore
    const valueJson = settingsRow.value || {};
    
    console.log(`📦 [MANIFEST] Value content:`, {
      name: valueJson.name,
      hasLogo: !!valueJson.store_logo_url,
      color: valueJson.primary_color,
    });
    
    // ✅ Extrair valores com sanitização
    const storeName = sanitizeForJson(valueJson.name || 'Pizzaria Forneiro Eden');
    const shortName = sanitizeForJson(storeName.split(' ')[0] || 'Forneiro Eden').substring(0, 12);
    const description = sanitizeForJson(`Cardápio digital e pedidos online da ${storeName}`);
    const primaryColor = valueJson.primary_color || '#ff9500';
    
    console.log(`🏪 [MANIFEST] Store info:`, {
      storeName,
      shortName,
      primaryColor,
    });
    
    // ✅ ESTRATÉGIA FINAL: Retornar URL DIRETA do Storage (browser faz download)
    let logoUrl = '';
    
    if (isValidUrl(valueJson.store_logo_url)) {
      // ✅ Logo customizada: usar URL direta do Supabase Storage
      logoUrl = valueJson.store_logo_url;
      console.log(`🖼️  [MANIFEST] Using logo URL: ${logoUrl.substring(0, 80)}...`);
    } else {
      // ❌ Sem logo: Gerar SVG customizado e converter para data URI
      console.log(`🎨 [MANIFEST] No logo URL, generating SVG...`);
      const firstLetter = storeName.substring(0, 1).toUpperCase();
      const svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
          <defs>
            <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' style='stop-color:${primaryColor};stop-opacity:1' />
              <stop offset='100%' style='stop-color:${primaryColor}dd;stop-opacity:1' />
            </linearGradient>
          </defs>
          <rect width='200' height='200' fill='url(#grad)' rx='40'/>
          <circle cx='100' cy='100' r='80' fill='rgba(255,255,255,0.1)'/>
          <text x='50%' y='50%' font-size='100' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='Arial, sans-serif'>${firstLetter}</text>
          <text x='50%' y='155' font-size='20' fill='white' text-anchor='middle' font-family='Arial, sans-serif' font-weight='500'>${storeName.substring(0, 15)}</text>
        </svg>
      `.trim();
      const svgBase64 = btoa(unescape(encodeURIComponent(svgContent)));
      logoUrl = `data:image/svg+xml;base64,${svgBase64}`;
      console.log(`✅ [MANIFEST] SVG generated`);
    }

    console.log(`✅ [MANIFEST] Building manifest for: ${storeName}`);

    // Build manifest com dados customizados
    const manifest = {
      "name": storeName,
      "short_name": shortName,
      "description": description,
      "start_url": "/",
      "scope": "/",
      "display": "standalone",
      "background_color": "#000000",
      "theme_color": primaryColor,
      "orientation": "portrait-primary",
      "icons": [
        {
          "src": logoUrl,
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": logoUrl,
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": logoUrl,
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "maskable"
        }
      ],
      "categories": ["food", "shopping"],
      "screenshots": [
        {
          "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 540 720'><rect fill='%23000' width='540' height='720'/><text x='50%' y='50%' font-size='200' fill='%23ff9500' text-anchor='middle' dominant-baseline='middle' font-family='serif' font-weight='bold'>🔵</text><text x='50%' y='80%' font-size='40' fill='%23fff' text-anchor='middle'>Forneiro Eden</text></svg>",
          "sizes": "540x720",
          "type": "image/svg+xml",
          "form_factor": "narrow"
        }
      ],
      "shortcuts": [
        {
          "name": "Novo Pedido",
          "short_name": "Novo Pedido",
          "description": "Fazer um novo pedido rapidamente",
          "url": "/?order=new",
          "icons": [
            {
              "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect fill='%23ff9500' width='96' height='96'/><text x='50%' y='50%' font-size='60' text-anchor='middle' dominant-baseline='middle'>+</text></svg>",
              "sizes": "96x96",
              "type": "image/svg+xml"
            }
          ]
        }
      ]
    };

    // ✅ Validação final
    try {
      JSON.stringify(manifest);
      console.log(`✅ [MANIFEST] JSON valid`);
    } catch (e) {
      console.error(`❌ [MANIFEST] JSON serialization error:`, e);
      return new Response(
        JSON.stringify(getFallbackManifest()),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`✅ [GET-MANIFEST] SUCCESS - Returning custom manifest`);
    console.log(`📊 Manifest: name=${storeName}, hasLogo=${isValidUrl(valueJson.store_logo_url)}`);
    
    return new Response(
      JSON.stringify(manifest),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('❌ [GET-MANIFEST] GENERAL ERROR:', error);
    console.error('Stack:', (error as any).stack);
    return new Response(
      JSON.stringify(getFallbackManifest()),
      { status: 200, headers: corsHeaders }
    );
  }
});
