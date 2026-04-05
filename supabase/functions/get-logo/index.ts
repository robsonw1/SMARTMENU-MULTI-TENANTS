import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // ✅ CORS Headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range'
        }
      });
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const size = url.searchParams.get('size') || '192';

    // ✅ Validate tenant_id
    if (!tenantId) {
      const svgContent = generateSVG('🔵', '#ff9500', parseInt(size), 'Forneiro Eden');
      return new Response(new TextEncoder().encode(svgContent), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ✅ Fetch from Supabase using native fetch
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // ✅ Query settings for this tenant
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/settings?tenant_id=eq.${tenantId}&select=value`,
      {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!settingsResponse.ok) {
      // Fallback: SVG
      const svgContent = generateSVG('🔵', '#ff9500', parseInt(size), 'Forneiro Eden');
      return new Response(new TextEncoder().encode(svgContent), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const settingsData = await settingsResponse.json() as any[];

    if (!settingsData || settingsData.length === 0 || !settingsData[0]?.value) {
      // Fallback: SVG with generic color
      const svgContent = generateSVG('🔵', '#ff9500', parseInt(size), 'Forneiro Eden');
      return new Response(new TextEncoder().encode(svgContent), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const settingsValue = settingsData[0].value;
    const logoUrl = settingsValue?.store_logo_url;
    const primaryColor = settingsValue?.primary_color || '#ff9500';
    const storeName = settingsValue?.name || 'Forneiro Eden';

    if (!logoUrl) {
      // Fallback: SVG with tenant color
      const svgContent = generateSVG('🔵', primaryColor, parseInt(size), storeName);
      return new Response(new TextEncoder().encode(svgContent), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ✅ Download logo from Supabase Storage (5 second timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const logoResponse = await fetch(logoUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (logoResponse.ok) {
        const logoBuffer = await logoResponse.arrayBuffer();
        return new Response(logoBuffer, {
          status: 200,
          headers: {
            'Content-Type': logoResponse.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=86400', // 24 hours
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (downloadError) {
      clearTimeout(timeout);
      console.error('Logo download failed:', downloadError);
    }

    // ✅ Final fallback: SVG with color + name
    const svgContent = generateSVG('🔵', primaryColor, parseInt(size), storeName);
    return new Response(new TextEncoder().encode(svgContent), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Logo endpoint error:', error);
    // ✅ Ultra-safe fallback: Minimal SVG
    const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="#ff9500" width="192" height="192"/><text x="96" y="96" font-size="120" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="bold">F</text></svg>`;
    return new Response(new TextEncoder().encode(fallbackSVG), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

// ✅ Utility: Generate SVG icon
function generateSVG(emoji: string, color: string, size: number, text: string): string {
  const fontSize = Math.round(size * 0.5);
  const textFontSize = Math.round(size * 0.2);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${adjustColor(color, -20)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect fill="url(#grad)" width="${size}" height="${size}"/>
    <text x="${size / 2}" y="${size * 0.45}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    <text x="${size / 2}" y="${size * 0.85}" font-size="${textFontSize}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-weight="bold">${text.substring(0, 3)}</text>
  </svg>`;
}

// ✅ Utility: Adjust hex color brightness
function adjustColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
