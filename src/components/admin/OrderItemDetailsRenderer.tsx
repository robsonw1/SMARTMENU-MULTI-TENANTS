/**
 * 🎯 RENDERIZADOR DE ITENS: Exibe detalhes de pedidos no Dashboard
 * Visual limpo e organizado como no carrinho do cliente
 */

interface ItemData {
  itemType?: 'inteira' | 'meia-meia';
  sabor1?: string;
  sabor2?: string | null;
  halfOne?: string;
  halfTwo?: string | null;
  drink?: string | null;
  border?: string | null;
  extras?: string[];
  customIngredients?: string[];
  paidIngredients?: string[];
  comboItems?: Array<{
    itemId?: string;
    itemName?: string;
    isHalfHalf?: boolean;
    halfOne?: string;
    halfTwo?: string;
  }>;
  notes?: string | null;
}

interface OrderItemProps {
  productName: string;
  quantity: number;
  size?: string;
  totalPrice?: number;
  itemData?: ItemData | null;
  format?: 'dashboard' | 'print' | 'compact';
}

const extractName = (value: any): string => {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.name) return String(value.name);
  return String(value);
};

const formatPrice = (price: number | undefined) => {
  if (!price) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

/**
 * 📱 DASHBOARD - Layout limpo e organizador como carrinho
 */
export const renderDashboardItem = (props: OrderItemProps): React.ReactNode => {
  const { productName, quantity, size, totalPrice, itemData } = props;

  return (
    <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 space-y-3">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start">
        <div>
          <h5 className="font-bold text-base leading-tight">
            {quantity}x {productName}
          </h5>
          {size && (
            <p className="text-sm text-slate-600 mt-1">
              {size === 'broto' ? 'Broto' : size === 'grande' ? 'Grande' : size}
            </p>
          )}
        </div>
        {totalPrice && (
          <span className="font-bold text-base text-orange-600">{formatPrice(totalPrice)}</span>
        )}
      </div>

      {/* Detalhes do Item */}
      {itemData && (
        <div className="space-y-3 border-t border-slate-300 pt-3">
          {/* COMBO ITENS - Cada item com seu tipo claramente indicado */}
          {itemData.comboItems && itemData.comboItems.length > 0 && (
            <div className="space-y-1">
              {itemData.comboItems.map((item, idx) => {
                // Determinar tipo desta pizza específica
                const pizzaType = item.isHalfHalf ? 'Meia-Meia' : 'Inteira';
                
                // Sabores do combo item
                const sabor1 = item.halfOne || '-';
                const sabor2 = item.halfTwo || null;
                
                return (
                  <div key={idx} className="pb-3 border-b border-slate-300 last:border-0 last:pb-0">
                    {/* Título da pizza */}
                    <p className="font-bold text-slate-900 mb-2">
                      Pizza {idx + 1} - Tipo: {pizzaType}
                    </p>
                    
                    {/* Conteúdo da pizza */}
                    {item.isHalfHalf ? (
                      <>
                        <p className="text-sm text-slate-700 ml-2">
                          • Sabor 1: {extractName(sabor1)}
                        </p>
                        <p className="text-sm text-slate-700 ml-2">
                          • Sabor 2: {extractName(sabor2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-700 ml-2">
                        • Sabor: {extractName(sabor1)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PIZZA SIMPLES (não combo) */}
          {itemData.sabor1 && !itemData.comboItems?.length && (
            <div className="space-y-1">
              {/* Detectar corretamente se é meia-meia ou inteira */}
              {itemData.sabor2 ? (
                <>
                  <p className="font-bold text-slate-900 mb-2">Tipo: Meia-Meia</p>
                  <p className="text-sm text-slate-700 ml-2">
                    • Sabor 1: {extractName(itemData.sabor1)}
                  </p>
                  <p className="text-sm text-slate-700 ml-2">
                    • Sabor 2: {extractName(itemData.sabor2)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-900 mb-2">Tipo: Inteira</p>
                  <p className="text-sm text-slate-700 ml-2">
                    • Sabor: {extractName(itemData.sabor1)}
                  </p>
                </>
              )}
            </div>
          )}

          {/* MEIA-MEIA (halfOne/halfTwo) - fallback raro */}
          {(itemData.halfOne || itemData.halfTwo) && !itemData.comboItems?.length && !itemData.sabor1 && (
            <div className="space-y-1">
              <p className="font-bold text-slate-900 mb-2">Tipo: Meia-Meia</p>
              <p className="text-sm text-slate-700 ml-2">
                • {extractName(itemData.halfOne)}
              </p>
              <p className="text-sm text-slate-700 ml-2">
                • {extractName(itemData.halfTwo)}
              </p>
            </div>
          )}

          {/* BORDA */}
          {itemData.border && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 text-sm">Borda:</p>
              <p className="text-sm text-slate-700 ml-2">{extractName(itemData.border)}</p>
            </div>
          )}

          {/* BEBIDA */}
          {itemData.drink && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 text-sm">Bebida:</p>
              <p className="text-sm text-slate-700 ml-2">{extractName(itemData.drink)}</p>
            </div>
          )}

          {/* EXTRAS/ADICIONAIS */}
          {itemData.extras && itemData.extras.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 text-sm">Adicionais:</p>
              <div className="ml-2">
                {itemData.extras.map((extra, idx) => (
                  <p key={idx} className="text-sm text-slate-700">
                    • {extractName(extra)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* OBSERVAÇÕES */}
          {itemData.notes && (
            <div className="space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
              <p className="font-semibold text-amber-900 text-sm">Observação:</p>
              <p className="text-sm text-amber-800">{itemData.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 🖨️ IMPRESSÃO - Formato compacto para térmica
 */
export const renderPrintItem = (props: OrderItemProps): string => {
  const { productName, quantity, size, itemData } = props;

  let html = `
    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
        ${quantity}x ${productName}${size ? ` (${size})` : ''}
      </div>
  `;

  if (itemData) {
    // Combo Pizzas
    if (itemData.comboItems && itemData.comboItems.length > 0) {
      html += `<div style="margin-left: 10px; font-size: 11px; margin-bottom: 6px;">
        <strong>Pizzas:</strong>`;
      itemData.comboItems.forEach((pizza, idx) => {
        html += `<div style="margin-left: 8px;">Pizza ${idx + 1}: ${extractName(pizza.halfOne)}`;
        if (pizza.isHalfHalf) {
          html += `<br style="margin-left: 16px;">• ${extractName(pizza.halfOne)} / ${extractName(pizza.halfTwo)}`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    // Pizza simples
    if (itemData.sabor1 && !itemData.comboItems?.length) {
      html += `<div style="margin-left: 10px; font-size: 11px; margin-bottom: 6px;">
        Pizza: ${extractName(itemData.sabor1)}`;
      if (itemData.sabor2) {
        html += `<br>Metade 2: ${extractName(itemData.sabor2)}`;
      }
      html += `</div>`;
    }

    // Borda
    if (itemData.border) {
      html += `<div style="margin-left: 10px; font-size: 11px; margin-bottom: 6px;">Borda: ${extractName(itemData.border)}</div>`;
    }

    // Bebida
    if (itemData.drink) {
      html += `<div style="margin-left: 10px; font-size: 11px; margin-bottom: 6px;">Bebida: ${extractName(itemData.drink)}</div>`;
    }

    // Extras
    if (itemData.extras && itemData.extras.length > 0) {
      html += `<div style="margin-left: 10px; font-size: 11px; margin-bottom: 6px;">
        + ${itemData.extras.map(e => extractName(e)).join(', ')}
      </div>`;
    }

    // Notas
    if (itemData.notes) {
      html += `<div style="margin-left: 10px; font-size: 10px; font-style: italic; color: #666; margin-top: 6px;">
        Obs: ${itemData.notes}
      </div>`;
    }
  }

  html += `</div>`;
  return html;
};

/**
 * ⚡ COMPACTO - Uma linha
 */
export const renderCompactItem = (props: OrderItemProps): string => {
  const { productName, quantity, size, itemData } = props;
  let text = `${quantity}x ${productName}`;
  if (size) text += ` (${size})`;
  if (itemData?.drink) text += ` | Bebida: ${extractName(itemData.drink)}`;
  if (itemData?.border) text += ` | Borda: ${extractName(itemData.border)}`;
  if (itemData?.extras?.length) text += ` | +${itemData.extras.map(e => extractName(e)).join(', ')}`;
  return text;
};

/**
 * ⚛️ COMPONENTE REACT
 */
export function OrderItemDetails(props: OrderItemProps) {
  return <>{renderDashboardItem(props)}</>;
}

export function OrderItemsList({ items }: { items: OrderItemProps[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <OrderItemDetails key={index} {...item} />
      ))}
    </div>
  );
}
