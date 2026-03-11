import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useNeighborhoodsStore } from '@/store/useNeighborhoodsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Product, Order, Neighborhood } from '@/data/products';

/**
 * Converte os dados do Supabase (JSON) para o formato Product esperado
 */
const parseProductFromSupabase = (supabaseData: any): Product => {
  let data = supabaseData.data || {};
  
  // Se data for string (às vezes Supabase retorna como JSON string), fazer parse
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.warn('❌ Erro ao fazer parse de data JSON:', e);
      data = {};
    }
  }
  
  // ✅ Determinar isActive: se está explicitamente false, é false. Caso contrário, true
  const isActive = data.is_active === true || (data.is_active !== false && data.is_active !== undefined);
  
  console.log('🔄 Parseando produto do Realtime:', {
    id: supabaseData.id,
    name: supabaseData.name,
    is_active_raw: data.is_active,
    is_active_parsed: isActive,
  });
  
  return {
    id: supabaseData.id,
    name: supabaseData.name || data.name,
    description: data.description || '',
    ingredients: data.ingredients || [],
    category: data.category || 'combos',
    price: data.price ?? undefined,
    // ✅ Suportar ambos os formatos: camelCase (priceSmall) e snake_case (price_small)
    priceSmall: data.priceSmall ?? data.price_small ?? undefined,
    priceLarge: data.priceLarge ?? data.price_large ?? undefined,
    image: data.image,
    isPopular: data.is_popular ?? false,
    isNew: data.is_new ?? false,
    isVegetarian: data.is_vegetarian ?? false,
    isActive: isActive,
    isCustomizable: data.is_customizable ?? false,
  };
};

/**
 * Converte dados do Supabase (snake_case) para o formato Neighborhood esperado (camelCase)
 */
const parseNeighborhoodFromSupabase = (supabaseData: any): Neighborhood => {
  return {
    id: supabaseData.id,
    name: supabaseData.name,
    deliveryFee: supabaseData.delivery_fee ?? 0,
    isActive: supabaseData.is_active === true,
  };
};

/**
 * Hook que sincroniza os dados da aplicação com o Supabase em tempo real
 * Carrega os dados iniciais e escuta mudanças em produtos, pedidos, bairros e configurações
 * 
 * ESTRATÉGIA PRODUTOS:
 * - Webhook Realtime: Primeira opção (ideal)
 * - Polling (10s): Fallback se webhook falhar
 * - Ambos usam parseProductFromSupabase() para converter dados corretamente
 */
export const useRealtimeSync = () => {
  useEffect(() => {
    console.log('🚀 Iniciando useRealtimeSync hook...');
    let isMounted = true;
    let productsPollInterval: NodeJS.Timeout | null = null;
    let neighborhoodsPollInterval: NodeJS.Timeout | null = null;
    
    // Rastrear tempo da última mudança local para cada produto
    const lastLocalProductUpdate = new Map<string, number>();

    // Função para sincronizar produtos via SELECT fresh (usado por webhook e polling)
    const syncProductsFromSupabase = async () => {
      if (!isMounted) return;
      
      try {
        const { data: products } = await (supabase as any)
          .from('products')
          .select('*');
        
        if (products && isMounted) {
          const catalogStore = useCatalogStore.getState();
          const currentTime = Date.now();
          const currentProducts = new Set(products.map((p: any) => p.id));
          
          // ✅ Sincronizar produtos existentes
          for (const product of products) {
            // Verificar se houve mudança local recente (últimos 3 segundos)
            const lastUpdate = lastLocalProductUpdate.get(product.id) || 0;
            const timeSinceLastUpdate = currentTime - lastUpdate;
            
            if (timeSinceLastUpdate < 3000) {
              // Ignorar se foi modificado há menos de 3 segundos (ainda esperando webhook)
              console.log(`⏭️  [PRODUCTS-POLLING] Pulando ${product.name} - mudança local ainda pendente`);
              continue;
            }
            
            catalogStore.upsertProduct(parseProductFromSupabase(product));
          }
          
          // ✅ Detectar e remover produtos que foram deletados no banco
          const storeProducts = catalogStore.getAll();
          for (const storeProduct of storeProducts) {
            if (!currentProducts.has(storeProduct.id)) {
              console.log(`🗑️ [PRODUCTS-POLLING] Produto deletado detectado: ${storeProduct.id} - ${storeProduct.name}`);
              catalogStore.removeProduct(storeProduct.id);
            }
          }
        }
      } catch (error) {
        console.error('❌ Erro ao sincronizar produtos:', error);
      }
    };

    // Função para sincronizar bairros via SELECT fresh (usado por webhook e polling)
    const syncNeighborhoodsFromSupabase = async () => {
      if (!isMounted) return;
      
      try {
        const { data: neighborhoods } = await (supabase as any)
          .from('neighborhoods')
          .select('*');
        
        if (neighborhoods && isMounted) {
          const neighborhoodsStore = useNeighborhoodsStore.getState();
          
          // ✅ UPSERT: Adicionar/atualizar bairros existentes
          const currentNeighborhoodIds = new Set<string>();
          for (const neighborhood of neighborhoods) {
            const parsed = parseNeighborhoodFromSupabase(neighborhood);
            neighborhoodsStore.upsertNeighborhood(parsed);
            currentNeighborhoodIds.add(neighborhood.id);
          }
          
          // ✅ DELETAR: Remover bairros que foram deletados no banco
          const storedNeighborhoods = neighborhoodsStore.neighborhoods || [];
          for (const storedNeighborhood of storedNeighborhoods) {
            if (!currentNeighborhoodIds.has(storedNeighborhood.id)) {
              console.log(`🗑️ [NEIGHBORHOODS-POLLING] Bairro deletado detectado: ${storedNeighborhood.id} - ${storedNeighborhood.name}`);
              neighborhoodsStore.removeNeighborhood(storedNeighborhood.id);
            }
          }
        }
      } catch (error) {
        console.error('❌ Erro ao sincronizar bairros:', error);
      }
    };

    // Função para carregar dados iniciais
    const loadInitialData = async () => {
      if (!isMounted) return;
      
      try {
        // Delay mínimo para garantir que localStorage foi carregado
        await new Promise(resolve => setTimeout(resolve, 100));

        // Carregar produtos
        const { data: products } = await (supabase as any)
          .from('products')
          .select('*');
        
        if (products && isMounted) {
          const catalogStore = useCatalogStore.getState();
          console.log(`✅ Carregados ${products.length} produtos inicialmente`);
          for (const product of products) {
            catalogStore.upsertProduct(parseProductFromSupabase(product));
          }
        }

        // ⚠️  NÃO carregar settings aqui - deixar AdminDashboard.tsx fazer isso
        // Se carregar aqui, sobrescreve dados recém-salvos com dados antigos do banco
        // O AdminDashboard.tsx chama loadSettingsFromSupabase() na montagem
        // useRealtimeSync apenas escuta mudanças posteriores via subscription

        // Carregar bairros
        const { data: neighborhoods } = await (supabase as any)
          .from('neighborhoods')
          .select('*');
        
        if (neighborhoods && isMounted) {
          const neighborhoodsStore = useNeighborhoodsStore.getState();
          console.log(`✅ Carregados ${neighborhoods.length} bairros inicialmente`);
          for (const neighborhood of neighborhoods) {
            const parsed = parseNeighborhoodFromSupabase(neighborhood);
            console.log('🔄 Neighborhood parseado:', parsed);
            neighborhoodsStore.upsertNeighborhood(parsed);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };

    loadInitialData();

    // ✅ WEBHOOK REALTIME: Primeira opção para sincronizar produtos
    // Sincronizar Produtos (Catálogo)
    const productsChannel = supabase
      .channel('realtime:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload: any) => {
          if (!isMounted) return;
          console.log('🔔 Webhook Produtos Realtime recebido:', payload.eventType, payload.new?.id || payload.old?.id, payload.new?.name || payload.old?.name);
          
          const catalogStore = useCatalogStore.getState();
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const product = parseProductFromSupabase(payload.new as any);
            console.log('✅ Atualizando produto via webhook:', product.id, 'isActive:', product.isActive, 'price:', product.price ?? product.priceSmall);
            
            // Registrar que este produto foi sincronizado via webhook
            lastLocalProductUpdate.set(payload.new.id, Date.now() + 10000); // +10s para evitar polling logo depois
            
            catalogStore.upsertProduct(product);
          } else if (payload.eventType === 'DELETE') {
            const oldProduct = payload.old as any;
            console.log('🗑️ Removendo produto via webhook:', oldProduct.id, oldProduct.name);
            catalogStore.removeProduct(oldProduct.id);
          }
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME-PRODUCTS] Canal Realtime ATIVO - ouvindo mudanças');
        } else if (error) {
          console.error('❌ [REALTIME-PRODUCTS] Erro ao conectar:', error?.message);
          console.log('🔄 [REALTIME-PRODUCTS] Ativando polling fallback para produtos...');
        }
      });

    // ⏰ POLLING FALLBACK: Se webhook falhar, faz sync a cada 10 segundos
    productsPollInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        console.log('🔄 [PRODUCTS-POLLING] Verificando atualizações de produtos...');
        await syncProductsFromSupabase();
      } catch (err) {
        console.error('❌ [PRODUCTS-POLLING] Erro no polling:', err);
      }
    }, 10000); // 10 segundos

    // ⏰ POLLING FALLBACK: Se webhook de bairros falhar, faz sync a cada 10 segundos
    neighborhoodsPollInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        console.log('🔄 [NEIGHBORHOODS-POLLING] Verificando atualizações de bairros...');
        await syncNeighborhoodsFromSupabase();
      } catch (err) {
        console.error('❌ [NEIGHBORHOODS-POLLING] Erro no polling:', err);
      }
    }, 10000); // 10 segundos

    // Sincronizar Pedidos
    const ordersChannel = supabase
      .channel('realtime:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          if (!isMounted) return;
          const ordersStore = useOrdersStore.getState();
          
          if (payload.eventType === 'INSERT') {
            // Novo pedido foi criado - sincronizar para pegar todos os dados
            // Não chamar addOrder aqui pois causariam duplicação (já foi inserido no BD)
            ordersStore.syncOrdersFromSupabase();
          } else if (payload.eventType === 'UPDATE') {
            // Pedido foi atualizado - sincronizar para pegar dados atualizados (status, printed_at, etc)
            ordersStore.syncOrdersFromSupabase();
          } else if (payload.eventType === 'DELETE') {
            ordersStore.removeOrder((payload.old as Order).id);
          }
        }
      )
      .subscribe();

    // Sincronizar Bairros
    const neighborhoodsChannel = supabase
      .channel('realtime:neighborhoods')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'neighborhoods' },
        (payload: any) => {
          if (!isMounted) return;
          console.log('🔔 Webhook Bairros Realtime recebido:', payload.eventType, payload.new?.id || payload.old?.id, payload.new?.name || payload.old?.name);
          
          const neighborhoodsStore = useNeighborhoodsStore.getState();
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const parsed = parseNeighborhoodFromSupabase(payload.new);
            console.log('✅ Atualizando bairro via webhook:', parsed.id, 'status:', parsed.isActive, 'taxa:', parsed.deliveryFee);
            neighborhoodsStore.upsertNeighborhood(parsed);
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ Removendo bairro via webhook:', payload.old.id);
            neighborhoodsStore.removeNeighborhood((payload.old as Neighborhood).id);
          }
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME-NEIGHBORHOODS] Canal Realtime ATIVO - ouvindo mudanças');
        } else if (error) {
          console.error('❌ [REALTIME-NEIGHBORHOODS] Erro ao conectar:', error?.message);
          console.log('🔄 [REALTIME-NEIGHBORHOODS] Ativando polling fallback para bairros...');
        }
      });

    // ⚠️ NOTA: Sincronização de Settings agora é feita exclusivamente em use-settings-realtime-sync.ts
    // para evitar conflito de canais realtime. Este hook foi removido daqui.

    // Cleanup: Desinscrever de todos os canais ao desmontar e limpar polling
    return () => {
      isMounted = false;
      if (productsPollInterval) {
        clearInterval(productsPollInterval);
        console.log('🛑 [PRODUCTS-POLLING] Polling de produtos finalizado');
      }
      if (neighborhoodsPollInterval) {
        clearInterval(neighborhoodsPollInterval);
        console.log('🛑 [NEIGHBORHOODS-POLLING] Polling de bairros finalizado');
      }
      productsChannel.unsubscribe();
      ordersChannel.unsubscribe();
      neighborhoodsChannel.unsubscribe();
    };
  }, []);
};
