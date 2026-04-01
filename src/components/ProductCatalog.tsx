import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/ProductCard';
import { Gift, Tag, Pizza, Crown, Star, Cake, GlassWater, Heart, Zap, Utensils, Leaf, Coffee, Truck, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCategoryCarousel } from '@/hooks/use-category-carousel';

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Gift,
  Tag,
  Pizza,
  Crown,
  Star,
  Cake,
  GlassWater,
  Heart,
  Zap,
  Utensils,
  Leaf,
  Coffee,
};

export function ProductCatalog() {
  const [activeTab, setActiveTab] = useState('combos');
  const productsById = useCatalogStore((s) => s.productsById);
  const deliveryTimeMin = useSettingsStore((s) => s.settings.deliveryTimeMin);
  const deliveryTimeMax = useSettingsStore((s) => s.settings.deliveryTimeMax);
  const pickupTimeMin = useSettingsStore((s) => s.settings.pickupTimeMin);
  const pickupTimeMax = useSettingsStore((s) => s.settings.pickupTimeMax);
  const categoriesConfig = useSettingsStore((s) => s.settings.categories_config);
  const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);

  // 💾 Carregar categorias de localStorage NO PRIMEIRO RENDER (antes do BD)
  const cachedCategoriesConfig = useMemo(() => {
    try {
      const cached = localStorage.getItem('cached_categories_config');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar categories_config do localStorage:', error);
    }
    return null;
  }, []);

  // ✅ Usar: localStorage primeiro → depois store → defaults
  const effectiveCategories = categoriesConfig || cachedCategoriesConfig;

  // 🔄 Sincronizar BD em background assim que componente monta
  useEffect(() => {
    const tenantId = sessionStorage.getItem('sb-tenant-id-by-slug') || sessionStorage.getItem('sb-auth-tenant-id');
    if (tenantId) {
      // Carrega silenciosamente em background (forceRefresh)
      loadSettingsFromSupabase(true);
    }
  }, [loadSettingsFromSupabase]);

  const products = useMemo(() => Object.values(productsById), [productsById]);

  // Construir categorias dinamicamente a partir do settings
  const categories = useMemo(() => {
    if (!effectiveCategories || effectiveCategories.length === 0) {
      return [];
    }
    return effectiveCategories
      .filter((cat) => cat.enabled)
      .sort((a, b) => a.order - b.order)
      .map((cat) => ({
        id: cat.id,
        // Se não tem categoriesConfig no store + não tem cache = mostrar "Carregando..."
        label: !categoriesConfig && !cachedCategoriesConfig ? "Carregando..." : cat.label,
        icon: ICON_MAP[cat.icon_name] || Gift,
      }));
  }, [categoriesConfig, cachedCategoriesConfig]);

  // Definir aba ativa como primeira categoria habilitada
  useEffect(() => {
    if (categories.length > 0 && !categories.find((c) => c.id === activeTab)) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  const getByCategory = useMemo(() => {
    return (categoryId: string) =>
      products
        .filter((p) => p.category === (categoryId as any))
        .sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
  }, [products]);

  // Carrossel para mobile
  const carousel = useCategoryCarousel({
    totalItems: categories.length,
    onCategoryChange: (index) => {
      setActiveTab(categories[index].id);
    },
  });

  // Sincronizar carrossel quando activeTab muda (desktop)
  useEffect(() => {
    const categoryIndex = categories.findIndex((c) => c.id === activeTab);
    if (categoryIndex >= 0 && categoryIndex !== carousel.currentIndex) {
      carousel.goToCategory(categoryIndex);
    }
  }, [activeTab]);


  return (
    <section id="cardapio" className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            Nosso Cardápio
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            A Pizza mais recheada da cidade 🇮🇹.
          </p>

          {/* Delivery & Pickup Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge
              variant="outline"
              className="gap-2 bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-default"
            >
              <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold">
                {deliveryTimeMin}–{deliveryTimeMax}min
              </span>
            </Badge>
            
            <Badge
              variant="outline"
              className="gap-2 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-default"
            >
              <Store className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold">
                {pickupTimeMin}–{pickupTimeMax}min
              </span>
            </Badge>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="w-full">
          {/* Desktop: Horizontal Scroll Tabs */}
          <div className="hidden md:block overflow-x-auto scrollbar-hide -mx-4 px-4 mb-8">
            <div className="inline-flex h-auto p-1 bg-secondary/50 rounded-xl gap-1 min-w-max">
              {categories.map((category) => {
                const Icon = category.icon;
                const products = getByCategory(category.id as any);
                const isActive = activeTab === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{category.label}</span>
                    <span className="ml-1 text-xs opacity-70">
                      ({products.filter(p => p.isActive).length})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: Carousel with Navigation */}
          <div className="md:hidden mb-8 space-y-4">
            {/* Carousel Container */}
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={carousel.prevCategory}
                disabled={!carousel.canGoPrev || carousel.isAnimating}
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-primary/80 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-primary-foreground" />
              </button>

              {/* Carousel */}
              <div
                ref={carousel.containerRef}
                onTouchStart={carousel.handleTouchStart}
                onTouchEnd={carousel.handleTouchEnd}
                className="overflow-x-auto scrollbar-hide scroll-smooth"
              >
                <div className="inline-flex gap-2 px-8 min-w-max">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const products = getByCategory(category.id as any);
                    const isActive = activeTab === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => {
                          carousel.goToCategory(
                            categories.findIndex((c) => c.id === category.id)
                          );
                          setActiveTab(category.id);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary/50 text-foreground hover:bg-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium text-sm">{category.label}</span>
                        <span className="text-xs opacity-70">
                          ({products.filter(p => p.isActive).length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Arrow */}
              <button
                onClick={carousel.nextCategory}
                disabled={!carousel.canGoNext || carousel.isAnimating}
                className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-primary/80 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-2">
              {categories.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    carousel.goToCategory(index);
                    setActiveTab(categories[index].id);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    carousel.currentIndex === index
                      ? 'w-6 bg-primary'
                      : 'w-2 bg-primary/30 hover:bg-primary/50'
                  }`}
                  aria-label={`Go to category ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {(() => {
            const products = getByCategory(activeTab);
            console.log(`📦 Categoria ativa: "${activeTab}" | ${products.length} produtos totais`);
            return (
              <div className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </div>

                {products.filter(p => p.isActive).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Nenhum produto disponível nesta categoria.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}


