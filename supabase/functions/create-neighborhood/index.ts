import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CreateNeighborhoodRequest {
  tenantId: string;
  neighborhood: {
    id: string;
    name: string;
    delivery_fee: number;
    is_active: boolean;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: CreateNeighborhoodRequest = await req.json();
    const { tenantId, neighborhood } = payload;

    // Validate input
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing tenantId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!neighborhood || !neighborhood.id || !neighborhood.name) {
      return new Response(
        JSON.stringify({ error: "Invalid neighborhood data" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log(`🏘️  [CREATE-NEIGHBORHOOD] Creating neighborhood for tenant: ${tenantId}`);
    console.log(`   ID: ${neighborhood.id}`);
    console.log(`   Name: ${neighborhood.name}`);
    console.log(`   Delivery Fee: R$ ${neighborhood.delivery_fee}`);

    // Insert neighborhood with tenant_id (service role bypasses RLS)
    const { data, error } = await supabase
      .from("neighborhoods")
      .insert([
        {
          id: neighborhood.id,
          name: neighborhood.name,
          delivery_fee: neighborhood.delivery_fee,
          is_active: neighborhood.is_active ?? true,
          tenant_id: tenantId,
        },
      ])
      .select();

    if (error) {
      console.error(`❌ [CREATE-NEIGHBORHOOD] Error inserting neighborhood:`, error);
      return new Response(
        JSON.stringify({
          error: "Failed to create neighborhood",
          details: error.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`✅ [CREATE-NEIGHBORHOOD] Neighborhood created successfully:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        data: data?.[0] || neighborhood,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error(`❌ [CREATE-NEIGHBORHOOD] Exception:`, error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
