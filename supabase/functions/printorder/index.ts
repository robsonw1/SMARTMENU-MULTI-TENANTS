import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    const { orderId, force = false } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "orderId is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados do pedido (ou criar um fake para teste)
    let order;
    if (orderId === "TEST-ORDER") {
      order = {
        id: "TEST-ORDER",
        customer_name: "Teste",
        total: 50.00,
        created_at: new Date().toISOString(),
        tenant_id: null, // TEST-ORDER não tem tenant
      };
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        console.error("Order error:", orderError);
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: corsHeaders }
        );
      }
      order = orderData;
    }

    // 2. Buscar configuração de impressora e métodos de pagamento
    // ✅ Usar tenant_id do order ou fallback para store-settings
    let settingsQuery = supabase
      .from("settings")
      .select("printnode_printer_id, print_mode, auto_print_pix, auto_print_card, auto_print_cash");

    if (order.tenant_id) {
      const settingsId = `settings_${order.tenant_id}`;
      settingsQuery = settingsQuery.eq("id", settingsId);
    } else {
      // Fallback para compatibilidade com TEST-ORDER
      settingsQuery = settingsQuery.eq("id", "store-settings");
    }

    const { data: settings, error: settingsError } = await settingsQuery.single();

    if (settingsError || !settings?.printnode_printer_id) {
      console.error("Settings error:", settingsError);
      return new Response(
        JSON.stringify({
          error: "Printer not configured",
          details: settingsError?.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Verificar modo de impressão e método de pagamento
    const shouldAutoPrint = () => {
      if (force) return true;
      if (settings.print_mode === "auto") {
        const paymentMethod = order.payment_method?.toLowerCase();
        if (paymentMethod === "pix" && settings.auto_print_pix) return true;
        if (paymentMethod === "card" && settings.auto_print_card) return true;
        if (paymentMethod === "cash" && settings.auto_print_cash) return true;
        if (!paymentMethod) return true;
      }
      return false;
    };

    if (!shouldAutoPrint()) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Order not auto-printed based on payment method settings.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 4. Buscar items do pedido (ou usar fake para teste)
    let orderItems = [];
    if (orderId !== "TEST-ORDER") {
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      orderItems = items || [];
    } else {
      orderItems = [
        {
          quantity: 1,
          product_name: "Pizza Margherita",
          price: 45.00,
          item_data: {
            size: "Grande",
            border: "Catupiry",
            comboPizzas: [],
            sabor1: "Margherita",
            sabor2: null,
            drink: "Coca-Cola 2L",
            extras: [],
            notes: "sem tomate",
          },
        },
      ];
    }

    // 5. Montar bytes da comanda (com ESC/POS igual ao n8n)
    const receiptBytes = buildReceipt(order, orderItems || []);

    // 6. Enviar para PrintNode
    const apiKey = Deno.env.get("PRINTNODE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const printNodeResult = await sendToPrintNode(
      apiKey,
      settings.printnode_printer_id,
      receiptBytes
    );

    if (!printNodeResult.success) {
      return new Response(
        JSON.stringify({
          error: "Failed to send to PrintNode",
          details: printNodeResult.error,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order sent to printer",
        printJobId: printNodeResult.printJobId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// ─────────────────────────────────────────────────────────────
//  buildReceipt — monta o cupom e retorna Uint8Array com ESC/POS
// ─────────────────────────────────────────────────────────────
function buildReceipt(order: any, items: any[]): Uint8Array {
  const LARGURA = 42;

  function centralizar(txt: string, largura = LARGURA): string {
    txt = txt.trim();
    if (txt.length >= largura) return txt.substring(0, largura);
    const espacos = Math.floor((largura - txt.length) / 2);
    return " ".repeat(espacos) + txt;
  }

  function wrapLinha(txt: string, largura = LARGURA): string[] {
    const out: string[] = [];
    let s = String(txt);
    while (s.length > largura) {
      let pos = s.lastIndexOf(" ", largura);
      if (pos <= 0) pos = largura;
      out.push(s.slice(0, pos));
      s = s.slice(pos).trimStart();
    }
    out.push(s);
    return out;
  }

  function add(blocos: string[], txt = "", alinhado = "esq"): void {
    const linhas = wrapLinha(txt);
    for (const l of linhas) {
      if (alinhado === "centro") blocos.push(centralizar(l));
      else blocos.push(l);
    }
  }

  // ── Cabeçalho ──
  const linhas: string[] = [];
  const numero = order.id || "XXXX";

  // Hora atual em Brasília (UTC-3) — igual ao n8n
  const agora = new Date();
  const brasiliaOffset = -3 * 60;
  const utc = agora.getTime() + agora.getTimezoneOffset() * 60000;
  const brasilia = new Date(utc + brasiliaOffset * 60000);
  const dataHora =
    `${String(brasilia.getDate()).padStart(2, "0")}/` +
    `${String(brasilia.getMonth() + 1).padStart(2, "0")}/` +
    `${brasilia.getFullYear()}, ` +
    `${String(brasilia.getHours()).padStart(2, "0")}:` +
    `${String(brasilia.getMinutes()).padStart(2, "0")}:` +
    `${String(brasilia.getSeconds()).padStart(2, "0")}`;

  add(linhas, `PEDIDO #${numero}`, "centro");
  add(linhas, `Data/Hora: ${dataHora}`);
  linhas.push("");

  // ── Dados do cliente ──
  add(linhas, `Cliente: ${order.customer_name || "-"}`);
  if (order.customer_phone) add(linhas, `Telefone: ${order.customer_phone}`);
  
  // Determinar se é entrega ou retirada
  const isEntrega = order.address?.neighborhood ? true : false;
  
  // Se for ENTREGA: mostrar endereço, bairro e taxa
  if (isEntrega) {
    const rua = order.address?.street || "";
    const num = order.address?.number || "";
    const comp = order.address?.complement ? ` ${order.address.complement}` : "";
    const endereco = `${rua}, ${num}${comp}`.trim();
    if (endereco) add(linhas, `Endereco: ${endereco}`);
    
    if (order.address?.neighborhood) add(linhas, `Bairro: ${order.address.neighborhood}`);
    
    if (order.address?.reference) add(linhas, `Referencia: ${order.address.reference}`);
    
    add(linhas, `Tipo de Pedido: Entrega`);
    
    const taxaEntrega = order.delivery_fee ? `R$ ${Number(order.delivery_fee).toFixed(2)}` : "R$ 0,00";
    add(linhas, `Taxa de entrega: ${taxaEntrega}`);
  } else {
    // Se for RETIRADA: só mostrar tipo de pedido
    add(linhas, `Tipo de Pedido: Retirada`);
  }

  // Traduzir payment_method para português
  const paymentTranslation: Record<string, string> = {
    "card": "Cartão",
    "cash": "Dinheiro",
    "pix": "PIX",
    "debit": "Débito"
  };
  const paymentDisplay = paymentTranslation[order.payment_method?.toLowerCase()] || order.payment_method || "-";
  
  // Adicionar troco se for dinheiro e cliente escolheu troco
  let paymentLine = `Pagamento: ${paymentDisplay}`;
  if (order.payment_method?.toLowerCase() === "cash" && order.address?.change_amount) {
    const changeVal = Number(order.address.change_amount);
    if (changeVal > 0) {
      paymentLine += ` (troco para R$ ${changeVal.toFixed(2)})`;
    }
  }
  add(linhas, paymentLine);

  linhas.push("");

  // ── Itens ──
  add(linhas, "ITENS DO PEDIDO:");

  for (const item of items) {
    const itemData = item.item_data || {};
    const itemPrice = item.total_price || item.price || item.product_price || 0;
    const itemQty = item.quantity || 1;
    let itemName = item.product_name || item.name || "Produto";
    
    // Tamanho pode vir de item.size (coluna) ou itemData.size (JSON)
    const itemSize = item.size || itemData.size;

    // Se não é combo e tem tamanho, adiciona no nome do item
    if (itemSize && (!itemData.comboPizzas || itemData.comboPizzas.length === 0)) {
      itemName = `${itemName} (${itemSize})`;
    }

    add(linhas, `- ${itemQty}x ${itemName}`);

    // Tamanho (só mostra se for combo)
    if (itemSize && itemData.comboPizzas && Array.isArray(itemData.comboPizzas) && itemData.comboPizzas.length > 0) {
      add(linhas, `  Tamanho: ${itemSize}`);
    }

    // ── comboPizzas: meia-meia mostra "Meia:" por sabor, inteira mostra "Sabor:" ──
    if (itemData.comboPizzas && Array.isArray(itemData.comboPizzas) && itemData.comboPizzas.length > 0) {
      itemData.comboPizzas.forEach((pizza: any) => {
        const tipo = pizza.isHalfHalf ? "Meia-Meia" : "Inteira";
        add(linhas, `  Pizza ${pizza.pizzaNumber} (${tipo})`);

        if (pizza.isHalfHalf) {
          if (pizza.halfOne) add(linhas, `    Meia: ${pizza.halfOne}`);
          if (pizza.halfTwo) add(linhas, `    Meia: ${pizza.halfTwo}`);
        } else {
          if (pizza.halfOne) add(linhas, `    Sabor: ${pizza.halfOne}`);
        }
      });
    }

    // ── sabor1/sabor2 só quando NÃO há comboPizzas ──
    if (itemData.sabor1 && (!itemData.comboPizzas || itemData.comboPizzas.length === 0)) {
      if (itemData.sabor2) {
        add(linhas, `    Meia: ${itemData.sabor1}`);
        add(linhas, `    Meia: ${itemData.sabor2}`);
      } else {
        add(linhas, `    Sabor: ${itemData.sabor1}`);
      }
    }

    // Borda
    if (itemData.border) add(linhas, `  Borda: ${itemData.border}`);

    // Bebida
    if (itemData.drink) add(linhas, `  Bebida: ${itemData.drink}`);

    // Extras
    if (itemData.extras && Array.isArray(itemData.extras) && itemData.extras.length > 0) {
      add(linhas, `  Adicionais: ${itemData.extras.join(", ")}`);
    }

    // ── CORREÇÃO 3: campo notes (observação por item) ──
    if (itemData.notes) add(linhas, `  Obs: ${itemData.notes}`);

    // Preço do item alinhado à direita
    const precoStr = `R$ ${Number(itemPrice).toFixed(2)}`;
    linhas.push(precoStr.padStart(LARGURA));
    linhas.push("");
  }

  // ── Totais ──
  linhas.push("=".repeat(LARGURA));

  const pointsUsed = order.points_redeemed || 0;
  if (pointsUsed > 0) linhas.push(`Pontos usados: ${pointsUsed}`);

  linhas.push("=".repeat(LARGURA));
  linhas.push((`TOTAL: R$ ${Number(order.total).toFixed(2)}`).padStart(LARGURA));
  linhas.push("=".repeat(LARGURA));
  linhas.push("");
  add(linhas, "FORNEIRO EDEN", "centro");
  linhas.push("\n\n"); // respiro final

  // ── Conversão para latin1: Mapa direto de acentos + fallback ──
  // Estratégia: Substituir acentos tônicos direto, depois converter para latin1
  function normalizarParaLatin1(str: string): string {
    // Mapa COMPLETO de acentos portugueses → sem acento (maxim eficiente)
    const acentosMap: Record<string, string> = {
      // Maiúsculas
      'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
      'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
      'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
      'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
      'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
      'Ç': 'C',
      // Minúsculas
      'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ç': 'c',
    };

    // Passo 1: Substituir todos os acentos mapeados
    let resultado = str;
    for (const [acentuado, semAcento] of Object.entries(acentosMap)) {
      resultado = resultado.split(acentuado).join(semAcento);
    }

    // Passo 2: Garantir que tudo esteja em latin1 (0-255)
    let bytesSeguros = "";
    for (let i = 0; i < resultado.length; i++) {
      const code = resultado.charCodeAt(i);
      // Se está em latin1, mantém; senão, ignora ou substitui por ?
      if (code <= 0xFF) {
        bytesSeguros += resultado.charAt(i);
      } else {
        // Fallback: tentar NFD uma última vez
        const ch = resultado.charAt(i);
        const nfd = ch.normalize("NFD");
        let converted = "";
        for (let j = 0; j < nfd.length; j++) {
          const c = nfd.charCodeAt(j);
          if (c <= 0xFF) converted += nfd.charAt(j);
        }
        bytesSeguros += converted || "?";
      }
    }

    return bytesSeguros;
  }

  // ── Converte para bytes latin1 ──
  const textoRaw = linhas.join("\n");
  const textoLatin1 = normalizarParaLatin1(textoRaw);
  const corpoBytes = new Uint8Array(textoLatin1.length);
  for (let i = 0; i < textoLatin1.length; i++) {
    corpoBytes[i] = textoLatin1.charCodeAt(i) & 0xff;
  }

  // ── Aplica ESC/POS igual ao n8n ──
  const ESC_T    = new Uint8Array([27, 116, 3]);   // ESC t 3 → codepage latin1
  const NEWLINES = new Uint8Array([10, 10, 10]);    // \n\n\n  → avança papel
  const CUT      = new Uint8Array([29, 86, 66, 0]); // GS V B 0 → corte parcial

  const total = ESC_T.length + corpoBytes.length + NEWLINES.length + CUT.length;
  const final = new Uint8Array(total);
  let offset = 0;
  final.set(ESC_T,      offset); offset += ESC_T.length;
  final.set(corpoBytes, offset); offset += corpoBytes.length;
  final.set(NEWLINES,   offset); offset += NEWLINES.length;
  final.set(CUT,        offset);

  return final;
}

// ─────────────────────────────────────────────────────────────
//  sendToPrintNode — envia os bytes para a API do PrintNode
// ─────────────────────────────────────────────────────────────
async function sendToPrintNode(
  apiKey: string,
  printerId: string,
  receiptBytes: Uint8Array
): Promise<{ success: boolean; printJobId?: string; error?: string }> {
  try {
    // Base64 dos bytes finais (já com ESC/POS embutido)
    let binary = "";
    for (let i = 0; i < receiptBytes.length; i++) {
      binary += String.fromCharCode(receiptBytes[i]);
    }
    const base64Content = btoa(binary);

    // Auth Basic: apiKey + ":"
    const rawKey = `${apiKey}:`;
    let keyBinary = "";
    for (let i = 0; i < rawKey.length; i++) {
      keyBinary += String.fromCharCode(rawKey.charCodeAt(i) & 0xff);
    }
    const base64ApiKey = btoa(keyBinary);

    const response = await fetch("https://api.printnode.com/printjobs", {
      method: "POST",
      headers: {
        Authorization: `Basic ${base64ApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerId: parseInt(printerId),
        title: "Comanda - Forneiro Eden",
        contentType: "raw_base64",
        content: base64Content,
        source: "Pizzaria Forneiro Eden",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`PrintNode error ${response.status}: ${errorText}`);
      return { success: false, error: `PrintNode API error: ${response.status}` };
    }

    const data = await response.json();
    console.log(`Print job created: ${data}`);
    return { success: true, printJobId: String(data) };
  } catch (error) {
    console.error("PrintNode error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}