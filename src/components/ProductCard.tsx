import { Product } from '@/data/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Leaf, Star, Sparkles, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/useStore';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { setSelectedProduct, setProductModalOpen } = useUIStore();

  const isUnavailable = !product.isActive;

  const handleClick = () => {
    if (isUnavailable) return;
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  // Logging para debug de realtime sync
  if (isUnavailable) {
    console.log(`📦 Produto ${product.id} (${product.name}) está UNAVAILABLE (isActive: ${product.isActive})`);
  }

  const getPrice = () => {
    if (product.price) return product.price;
    if (product.priceSmall && product.priceLarge) {
      return product.priceSmall;
    }
    return 0;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const isPizza = ['promocionais', 'tradicionais', 'premium', 'especiais', 'doces'].includes(product.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={
        "card-product group relative " +
        (isUnavailable ? "cursor-not-allowed" : "cursor-pointer")
      }
      onClick={handleClick}
    >
      {/* Overlay para produtos inativos */}
      {isUnavailable && (
        <div className="absolute inset-0 bg-black/15 rounded-xl flex flex-col items-center justify-center z-10 group-hover:bg-black/20 transition-all duration-300">
          <AlertCircle className="w-10 h-10 text-red-500 mb-1.5" />
          <div className="text-center">
            <p className="text-white font-bold text-sm">Produto</p>
            <p className="text-white font-bold text-sm">esgotado</p>
          </div>
        </div>
      )}

      {/* ✅ NOVO: Renderizar imagem se existir, senão fallback com emoji */}
      <div className="relative w-full h-40 bg-gradient-to-br from-orange-100 to-amber-100 rounded-t-xl flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Fallback se imagem não carregar
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-6xl">🍕</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 p-4 pb-0">
        {product.isPopular && (
          <Badge variant="default" className="badge-popular flex items-center gap-1">
            <Star className="w-3 h-3" />
            Popular
          </Badge>
        )}
        {product.isNew && (
          <Badge variant="default" className="bg-accent text-accent-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Novo
          </Badge>
        )}
        {product.isVegetarian && (
          <Badge variant="default" className="badge-promo flex items-center gap-1">
            <Leaf className="w-3 h-3" />
            Vegetariano
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1 line-clamp-1">
          {product.name}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {product.description || product.ingredients.slice(0, 4).join(', ')}
        </p>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            {isPizza && product.priceSmall && product.priceLarge ? (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">A partir de</span>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(product.priceSmall)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold text-primary">
                {formatPrice(getPrice())}
              </span>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary hover:bg-primary/10"
            disabled={isUnavailable}
          >
            {isUnavailable ? "Indisponível" : "Ver detalhes"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

