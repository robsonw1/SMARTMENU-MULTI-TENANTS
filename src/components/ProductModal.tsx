import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUIStore, useCartStore } from '@/store/useStore';
import { availableIngredients, meatIngredients, paidExtraIngredients, Product, CartItem } from '@/data/products';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { GlassWater, ChefHat } from 'lucide-react';
import { Plus, Minus, Leaf, Star, Sparkles, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import pizzaImage from '@/assets/cart-hero.jpg';

const MAX_FREE_INGREDIENTS = 6;

export function ProductModal() {
  const { selectedProduct, isProductModalOpen, setProductModalOpen, setSelectedProduct, setCartOpen } = useUIStore();
  const { addItem } = useCartStore();
  
  // ✅ Selector direto (padrão do ProductCatalog)
  // Zustand compara productsById por referência e dispara re-render se mudar
  const productsById = useCatalogStore((s) => s.productsById);
  
  // ✅ useMemo que depende de productsById (não de funções)
  // Isso garante que dados filtrados sejam recalculados quando productsById muda
  const allPizzas = useMemo(
    () => Object.values(productsById)
      .filter((p) => ['promocionais', 'tradicionais', 'premium', 'especiais', 'doces'].includes(p.category as any))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [productsById]
  );
  
  const promotionalPizzas = useMemo(
    () => Object.values(productsById)
      .filter((p) => p.category === 'promocionais')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [productsById]
  );
  
  const availableBordas = useMemo(
    () => Object.values(productsById)
      .filter((p) => p.category === 'bordas' && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [productsById]
  );
  
  const availableAdicionais = useMemo(
    () => Object.values(productsById)
      .filter((p) => p.category === 'adicionais' && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [productsById]
  );
  
  const availableDrinks = useMemo(
    () => Object.values(productsById)
      .filter((p) => p.category === 'bebidas' && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [productsById]
  );
  
  // ✅ NOVO: Usar sizeId dinâmico baseado em sizes_config
  // ⚠️ IMPORTANTE: Não chamar função em tempo de render, usar valor padrão seguro
  const [size, setSize] = useState<string>('grande');
  const [isHalfHalf, setIsHalfHalf] = useState(false);
  const [secondHalfId, setSecondHalfId] = useState<string>('');
  const [selectedBorder, setSelectedBorder] = useState<string>('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>('');
  const [comboPizza1Id, setComboPizza1Id] = useState<string>('');
  const [comboPizza2Id, setComboPizza2Id] = useState<string>('');
  const [comboPizza1HalfId, setComboPizza1HalfId] = useState<string>('');
  const [comboPizza2HalfId, setComboPizza2HalfId] = useState<string>('');
  const [isPizza1HalfHalf, setIsPizza1HalfHalf] = useState(false);
  const [isPizza2HalfHalf, setIsPizza2HalfHalf] = useState(false);
  const [customIngredients, setCustomIngredients] = useState<string[]>([]);
  const [paidIngredients, setPaidIngredients] = useState<string[]>([]);
  
  const isPizza = selectedProduct && 
    ['promocionais', 'tradicionais', 'premium', 'especiais', 'doces'].includes(selectedProduct.category);
  const isCombo = selectedProduct && selectedProduct.category === 'combos';
  const isCustomizable = selectedProduct?.isCustomizable || selectedProduct?.id === 'prem-moda-cliente';
  const showDrinkSelection = isPizza || isCombo;

  // ✅ Importar toggles do settings para sincronizar com admin
  const {
    meia_meia_enabled = true,
    bordas_enabled = true,
    adicionais_enabled = true,
    bebidas_enabled = true,
    imagens_enabled = true,
    broto_enabled = true,
    grande_enabled = true,
    sizes_config = [],
  } = useSettingsStore((s) => s.settings);

  const handleClose = () => {
    setProductModalOpen(false);
    setSelectedProduct(null);
    // Reset state 
    setSize('grande');
    setIsHalfHalf(false);
    setSecondHalfId('');
    setSelectedBorder('');
    setSelectedExtras([]);
    setQuantity(1);
    setSelectedDrinkId('');
    setComboPizza1Id('');
    setComboPizza2Id('');
    setComboPizza1HalfId('');
    setComboPizza2HalfId('');
    setIsPizza1HalfHalf(false);
    setIsPizza2HalfHalf(false);
    setCustomIngredients([]);
    setPaidIngredients([]);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const calculateTotal = () => {
    if (!selectedProduct) return 0;

    let total = 0;

    // ✅ NOVO: Helper para pegar preço de uma pizza por tamanho
    // Suporta tanto novo sistema (pricesBySize) quanto legado (priceSmall/priceLarge)
    const getPizzaPriceBySize = (pizza: Product, sizeId: string): number => {
      // Se pizza tem pricesBySize (novo sistema), usar
      if (pizza.pricesBySize && pizza.pricesBySize[sizeId]) {
        return pizza.pricesBySize[sizeId];
      }
      
      // Fallback para sistema legado
      if (sizeId === 'broto' && pizza.priceSmall) {
        return pizza.priceSmall;
      }
      if (sizeId === 'grande' && pizza.priceLarge) {
        return pizza.priceLarge;
      }
      
      // Se não encontrou, retorna 0 (produto sem preço)
      return 0;
    };

    // Base price
    if (isPizza) {
      // ✅ NOVO: Usar novo sistema de preços dinâmicos
      total = getPizzaPriceBySize(selectedProduct, size);
      
      // Half-half: use the higher price
      if (isHalfHalf && secondHalfId) {
        const secondPizza = allPizzas.find(p => p.id === secondHalfId);
        if (secondPizza) {
          const secondPrice = getPizzaPriceBySize(secondPizza, size);
          total = Math.max(total, secondPrice);
        }
      }
    } else if (selectedProduct.price) {
      total = selectedProduct.price;
    }

    // Border
    if (isPizza && selectedBorder && selectedBorder !== 'sem-borda') {
      const border = availableBordas.find(b => b.id === selectedBorder);
      if (border?.price) total += border.price;
    }

    // Extras
    selectedExtras.forEach(extraId => {
      const extra = availableAdicionais.find(a => a.id === extraId);
      if (extra?.price) total += extra.price;
    });

    // Paid custom ingredients - busca preço do adicional correspondente
    paidIngredients.forEach(ingredient => {
      const paidAdditional = availableAdicionais.find(a => a.name === ingredient);
      if (paidAdditional?.price) {
        total += paidAdditional.price;
      }
    });

    // Drink (only for non-combos - combos have free drink)
    if (!isCombo && selectedDrinkId && selectedDrinkId !== 'sem-bebida') {
      const drink = availableDrinks.find(d => d.id === selectedDrinkId);
      if (drink?.price) total += drink.price;
    }

    return total * quantity;
  };

  // Check if combo requires pizza selection
  const isComboFamilia = selectedProduct?.id === 'combo-familia';
  const isComboCasal = selectedProduct?.id === 'combo-casal';
  const isComboWithPizzaSelection = isComboFamilia || isComboCasal;
  const pizzaCountForCombo = isComboFamilia ? 2 : (isComboCasal ? 1 : 0);

  const handleIngredientToggle = (ingredient: string) => {
    // Check if meat is being selected (not allowed)
    if (meatIngredients.includes(ingredient) && ingredient !== 'Frango') {
      toast.error('Carnes não podem ser adicionadas como ingredientes. Apenas frango é permitido!');
      return;
    }

    if (customIngredients.includes(ingredient)) {
      setCustomIngredients(customIngredients.filter(i => i !== ingredient));
    } else if (customIngredients.length < MAX_FREE_INGREDIENTS) {
      setCustomIngredients([...customIngredients, ingredient]);
    } else {
      toast.error(`Você pode escolher no máximo ${MAX_FREE_INGREDIENTS} ingredientes gratuitos`);
    }
  };

  const handlePaidIngredientToggle = (ingredient: string) => {
    // Only allow specific ingredients as paid extras
    if (!paidExtraIngredients.includes(ingredient)) {
      toast.error('Este ingrediente não pode ser adicionado como extra pago');
      return;
    }

    if (paidIngredients.includes(ingredient)) {
      setPaidIngredients(paidIngredients.filter(i => i !== ingredient));
    } else {
      setPaidIngredients([...paidIngredients, ingredient]);
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    if (!selectedProduct.isActive) {
      toast.error('Este produto está indisponível no momento');
      return;
    }

    // Validate border selection (mandatory for pizzas)
    if (isPizza && !selectedBorder) {
      toast.error('Selecione sua borda (ou clique em "Não quero borda")');
      return;
    }

    // Validate drink selection (mandatory for pizzas and combos)
    if (showDrinkSelection && !selectedDrinkId) {
      toast.error('Escolha sua bebida ou selecione não quero bebida');
      return;
    }

    // Validate combo pizza selections
    if (isCombo) {
      if (isComboFamilia && (!comboPizza1Id || !comboPizza2Id)) {
        toast.error('Selecione os sabores das duas pizzas do combo');
        return;
      }
      if (isComboCasal && !comboPizza1Id) {
        toast.error('Selecione o sabor da pizza do combo');
        return;
      }
    }

    // Validate Moda do Cliente ingredients
    if (isCustomizable && customIngredients.length === 0) {
      toast.error('Selecione pelo menos 1 ingrediente para sua pizza');
      return;
    }

    const secondHalf = isHalfHalf && secondHalfId 
      ? allPizzas.find(p => p.id === secondHalfId)
      : undefined;
    
    const border = isPizza && selectedBorder !== 'sem-borda'
      ? availableBordas.find(b => b.id === selectedBorder)
      : undefined;

    const extras = selectedExtras
      .map(id => availableAdicionais.find(a => a.id === id))
      .filter(Boolean) as Product[];

    const selectedDrink = selectedDrinkId && selectedDrinkId !== 'sem-bebida'
      ? availableDrinks.find(d => d.id === selectedDrinkId) 
      : undefined;

    // Build combo pizza flavors array with half-half info
    const comboItems: any[] = [];
    const comboProductsData: any[] = [];
    if (isCombo) {
      if (comboPizza1Id) {
        const pizza1 = promotionalPizzas.find(p => p.id === comboPizza1Id);
        if (pizza1) {
          const pizza1Half = isPizza1HalfHalf && comboPizza1HalfId 
            ? promotionalPizzas.find(p => p.id === comboPizza1HalfId) 
            : undefined;
          const pizza1Item = {
            ...pizza1,
            isHalfHalf: isPizza1HalfHalf,
            secondHalf: pizza1Half,
          };
          console.log('🔵 [ProductModal] Combo Pizza 1:', {
            pizzaName: pizza1.name,
            isPizza1HalfHalf,
            comboPizza1HalfId,
            pizza1HalfName: pizza1Half?.name,
            savedObject: pizza1Item,
          });
          comboItems.push(pizza1Item);
          
          // Also save explicit data structure for serialization reliability
          comboProductsData.push({
            itemNumber: 1,
            itemId: pizza1.id,
            itemName: pizza1.name,
            isHalfHalf: isPizza1HalfHalf,
            secondHalfId: pizza1Half?.id,
            secondHalfName: pizza1Half?.name,
          });
        }
      }
      if (isComboFamilia && comboPizza2Id) {
        const pizza2 = promotionalPizzas.find(p => p.id === comboPizza2Id);
        if (pizza2) {
          const pizza2Half = isPizza2HalfHalf && comboPizza2HalfId 
            ? promotionalPizzas.find(p => p.id === comboPizza2HalfId) 
            : undefined;
          const pizza2Item = {
            ...pizza2,
            isHalfHalf: isPizza2HalfHalf,
            secondHalf: pizza2Half,
          };
          console.log('🔵 [ProductModal] Combo Pizza 2:', {
            pizzaName: pizza2.name,
            isPizza2HalfHalf,
            comboPizza2HalfId,
            pizza2HalfName: pizza2Half?.name,
            savedObject: pizza2Item,
          });
          comboItems.push(pizza2Item);
          
          // Also save explicit data structure for serialization reliability
          comboProductsData.push({
            itemNumber: 2,
            itemId: pizza2.id,
            itemName: pizza2.name,
            isHalfHalf: isPizza2HalfHalf,
            secondHalfId: pizza2Half?.id,
            secondHalfName: pizza2Half?.name,
          });
        }
      }
    }
    console.log('📦 [ProductModal] comboItems antes de salvar:', comboItems);
    console.log('📦 [ProductModal] comboProductsData antes de salvar:', comboProductsData);

    // Build itemData with all order details for rendering in cart/print
    const itemData: CartItem['itemData'] = {
      itemType: isHalfHalf ? 'meia-meia' : 'inteira',
      sabor1: selectedProduct?.name,
      sabor2: secondHalf?.name || null,
      halfOne: selectedProduct?.name,
      halfTwo: secondHalf?.name || null,
      drink: selectedDrink?.name || null,
      border: border?.name || null,
      extras: extras.map(e => e.name),
      customIngredients,
      paidIngredients,
      comboItems: isCombo ? comboProductsData.map(p => ({
        itemId: p.itemId,
        itemName: p.itemName,
        isHalfHalf: p.isHalfHalf,
        halfOne: p.itemName,
        halfTwo: p.secondHalfName || null,
      })) : undefined,
      notes: undefined,
    };

    const cartItem: CartItem = {
      id: '',
      product: selectedProduct,
      quantity,
      size: isPizza ? size : undefined,
      isHalfHalf,
      secondHalf,
      border,
      extras,
      drink: selectedDrink,
      isDrinkFree: isCombo,
      comboProductsData: comboProductsData.length > 0 ? comboProductsData : undefined,
      comboProductFlavors: comboItems.length > 0 ? comboItems : undefined,
      customIngredients: isCustomizable ? customIngredients : undefined,
      paidIngredients: isCustomizable && paidIngredients.length > 0 ? paidIngredients : undefined,
      totalPrice: calculateTotal(),
      itemData,
    };

    addItem(cartItem);
    toast.success(`${selectedProduct.name} adicionado ao carrinho!`);
    handleClose();
    setCartOpen(true);
  };

  if (!selectedProduct) return null;

  const isUnavailable = !selectedProduct.isActive;

  return (
    <Dialog open={isProductModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader>
              <div className="flex items-start gap-4">
                {/* Product Image */}
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                  <img 
                    src={pizzaImage} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {selectedProduct.isPopular && (
                      <Badge variant="default" className="badge-popular flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Popular
                      </Badge>
                    )}
                    {selectedProduct.isNew && (
                      <Badge variant="default" className="bg-accent text-accent-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Novo
                      </Badge>
                    )}
                    {selectedProduct.isVegetarian && (
                      <Badge variant="default" className="badge-promo flex items-center gap-1">
                        <Leaf className="w-3 h-3" />
                        Vegetariano
                      </Badge>
                    )}
                    {isCustomizable && (
                      <Badge variant="default" className="bg-primary text-primary-foreground flex items-center gap-1">
                        <ChefHat className="w-3 h-3" />
                        Personalizável
                      </Badge>
                    )}
                  </div>
                  
                  <DialogTitle className="font-heading text-xl md:text-2xl">
                    {selectedProduct.name}
                  </DialogTitle>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProduct.description}
                  </p>

                  {selectedProduct.ingredients.length > 0 && !isCustomizable && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Ingredientes:</span>{' '}
                      {selectedProduct.ingredients.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {/* Size Selection for Pizzas - Renderiza dinamicamente baseado em sizes_config */}
              {/* Size Selection for Pizzas */}
              {isPizza && selectedProduct.priceSmall && selectedProduct.priceLarge && ((sizes_config && Array.isArray(sizes_config) && sizes_config.length > 0) || broto_enabled || grande_enabled) && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">Tamanho</Label>
                  <RadioGroup value={size} onValueChange={(v) => {
                    setSize(v);
                    if (v === 'broto') setIsHalfHalf(false);
                  }}>
                    {/* Renderizar tamanhos customizados se disponível, senão usar fallback */}
                    {sizes_config && Array.isArray(sizes_config) && sizes_config.length > 0 ? (
                      <div className={`grid gap-3 ${((sizes_config.filter((s: any) => s.isActive) || []).length > 1 ? 'grid-cols-2' : 'grid-cols-1')}`}>
                        {(sizes_config.filter((s: any) => s.isActive) || []).map((sizeConfig: any) => (
                          <div key={sizeConfig.id} className="relative">
                            <RadioGroupItem value={sizeConfig.id} id={sizeConfig.id} className="peer sr-only" />
                            <Label htmlFor={sizeConfig.id} className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-secondary transition-colors">
                              <span className="font-semibold">{sizeConfig.name}</span>
                              <span className="text-lg font-bold text-primary">
                                {formatPrice(getPizzaPriceBySize(selectedProduct, sizeConfig.id))}
                              </span>
                              <span className="text-xs text-muted-foreground">{sizeConfig.description}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`grid gap-3 ${grande_enabled && broto_enabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {grande_enabled && (
                          <div className="relative">
                            <RadioGroupItem value="grande" id="grande" className="peer sr-only" />
                            <Label htmlFor="grande" className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-secondary transition-colors">
                              <span className="font-semibold">Grande</span>
                              <span className="text-lg font-bold text-primary">{formatPrice(getPizzaPriceBySize(selectedProduct, 'grande'))}</span>
                              <span className="text-xs text-muted-foreground">8 fatias</span>
                            </Label>
                          </div>
                        )}
                        {broto_enabled && (
                          <div className="relative">
                            <RadioGroupItem value="broto" id="broto" className="peer sr-only" />
                            <Label htmlFor="broto" className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-secondary transition-colors">
                              <span className="font-semibold">Broto</span>
                              <span className="text-lg font-bold text-primary">{formatPrice(getPizzaPriceBySize(selectedProduct, 'broto'))}</span>
                              <span className="text-xs text-muted-foreground">4 fatias</span>
                            </Label>
                          </div>
                        )}
                      </div>
                    )}
                  </RadioGroup>
                </div>
              )}

              {/* Custom Ingredients Selection for Moda do Cliente */}
              {isCustomizable && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary" />
                        Monte sua Pizza
                      </Label>
                      <Badge variant={customIngredients.length === MAX_FREE_INGREDIENTS ? "default" : "secondary"}>
                        {customIngredients.length}/{MAX_FREE_INGREDIENTS} ingredientes
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Escolha até {MAX_FREE_INGREDIENTS} ingredientes gratuitos para sua pizza personalizada
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                      {availableIngredients.map(ingredient => {
                        const isSelected = customIngredients.includes(ingredient);
                        const isDisabled = !isSelected && customIngredients.length >= MAX_FREE_INGREDIENTS;
                        
                        return (
                          <div 
                            key={ingredient} 
                            className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${
                              isSelected 
                                ? 'bg-primary/10 border-primary' 
                                : isDisabled 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : 'hover:bg-secondary cursor-pointer'
                            }`}
                            onClick={() => !isDisabled && handleIngredientToggle(ingredient)}
                          >
                            <Checkbox
                              id={`ing-${ingredient}`}
                              checked={isSelected}
                              disabled={isDisabled}
                              onCheckedChange={() => handleIngredientToggle(ingredient)}
                            />
                            <Label 
                              htmlFor={`ing-${ingredient}`} 
                              className={`text-sm flex-1 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {ingredient}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    {customIngredients.length > 0 && (
                      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-sm font-medium mb-2">Seus ingredientes gratuitos:</p>
                        <div className="flex flex-wrap gap-1">
                          {customIngredients.map(ing => (
                            <Badge 
                              key={ing} 
                              variant="secondary" 
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleIngredientToggle(ing)}
                            >
                              {ing} ✕
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paid Extra Ingredients */}
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                          Ingredientes Adicionais
                        </Label>
                        {paidIngredients.length > 0 && (
                          <Badge variant="outline" className="bg-amber-50">
                            +{formatPrice(paidIngredients.reduce((total, ing) => {
                              const paidAdditional = availableAdicionais.find(a => a.name === ing);
                              return total + (paidAdditional?.price || 0);
                            }, 0))}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione ingredientes extras (preços conforme tabela de adicionais)
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {paidExtraIngredients.map(ingredient => {
                          const isSelected = paidIngredients.includes(ingredient);
                          const isAlreadyFree = customIngredients.includes(ingredient);
                          const paidAdditional = availableAdicionais.find(a => a.name === ingredient);
                          const price = paidAdditional?.price || 0;
                          
                          return (
                            <div 
                              key={ingredient} 
                              className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${
                                isAlreadyFree
                                  ? 'opacity-50 cursor-not-allowed bg-secondary/30 border-muted-foreground/20' 
                                  : isSelected 
                                    ? 'bg-amber-950/40 border-amber-600/50' 
                                    : 'hover:bg-secondary/50 cursor-pointer border-muted-foreground/30'
                              }`}
                              onClick={() => !isAlreadyFree && handlePaidIngredientToggle(ingredient)}
                            >
                              <Checkbox
                                id={`paid-ing-${ingredient}`}
                                checked={isSelected}
                                disabled={isAlreadyFree}
                                onCheckedChange={() => handlePaidIngredientToggle(ingredient)}
                              />
                              <div className="flex-1">
                                <Label 
                                  htmlFor={`paid-ing-${ingredient}`} 
                                  className={`text-sm ${isAlreadyFree ? 'cursor-not-allowed line-through text-muted-foreground' : 'cursor-pointer'}`}
                                  title={isAlreadyFree ? 'Já incluído nos ingredientes gratuitos' : ''}
                                >
                                  {ingredient}
                                </Label>
                                <span className="text-xs text-amber-600 font-semibold block">
                                  +{formatPrice(price)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {paidIngredients.length > 0 && (
                        <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm font-medium mb-2">Seus ingredientes adicionais:</p>
                          <div className="flex flex-wrap gap-1">
                            {paidIngredients.map(ing => {
                              const paidAdditional = availableAdicionais.find(a => a.name === ing);
                              const price = paidAdditional?.price || 0;
                              return (
                                <Badge 
                                  key={ing} 
                                  variant="secondary" 
                                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => handlePaidIngredientToggle(ing)}
                                >
                                  {ing} +{formatPrice(price)} ✕
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Half-Half Option - Only for Grande size and non-customizable */}
              {isPizza && size === 'grande' && !isCustomizable && meia_meia_enabled && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base font-semibold">Meia-Meia</Label>
                      <Switch checked={isHalfHalf} onCheckedChange={setIsHalfHalf} />
                    </div>
                    
                    <AnimatePresence>
                      {isHalfHalf && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <Label className="text-sm text-muted-foreground mb-2 block">
                            Escolha a segunda metade:
                          </Label>
                          <Select value={secondHalfId} onValueChange={setSecondHalfId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um sabor" />
                            </SelectTrigger>
                            <SelectContent>
                              {allPizzas
                                .filter(p => p.id !== selectedProduct.id && p.isActive)
                                .map(pizza => (
                                  <SelectItem key={pizza.id} value={pizza.id}>
                                    {pizza.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-2">
                            * O preço será o do sabor mais caro
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* Border Selection */}
              {isPizza && bordas_enabled && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Borda <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedBorder} onValueChange={setSelectedBorder}>
                      <SelectTrigger className={!selectedBorder ? 'text-muted-foreground' : ''}>
                        <SelectValue placeholder="Selecione sua Borda..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem-borda">❌ Não quero borda</SelectItem>
                        {availableBordas.map(border => (
                          <SelectItem key={border.id} value={border.id}>
                            {border.name} (+{formatPrice(border.price!)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Extras - Only for non-customizable pizzas */}
              {isPizza && !isCustomizable && adicionais_enabled && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Adicionais <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {availableAdicionais.map(adicional => (
                        <div key={adicional.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={adicional.id}
                            checked={selectedExtras.includes(adicional.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedExtras([...selectedExtras, adicional.id]);
                              } else {
                                setSelectedExtras(selectedExtras.filter(id => id !== adicional.id));
                              }
                            }}
                          />
                          <Label 
                            htmlFor={adicional.id} 
                            className="text-sm cursor-pointer flex-1"
                          >
                            {adicional.name}
                            <span className="text-muted-foreground ml-1">
                              +{formatPrice(adicional.price!)}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Combo Pizza Flavor Selection - Only promotional pizzas */}
              {isCombo && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      {isComboFamilia ? 'Faça sua escolha' : 'Escolha oque deseja'}
                    </Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      * Disponível apenas promocionais
                    </p>
                    
                    {/* Pizza 1 */}
                    <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
                      <Label className="text-sm font-medium mb-2 block">
                        {isComboFamilia ? 'Pizza 1:' : 'Sua escolha?:'}
                      </Label>
                      <Select value={comboPizza1Id} onValueChange={setComboPizza1Id}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um sabor" />
                        </SelectTrigger>
                        <SelectContent>
                          {promotionalPizzas.filter(p => p.isActive).map(pizza => (
                            <SelectItem key={pizza.id} value={pizza.id}>
                              {pizza.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Half-Half for Pizza 1 - All Combos */}
                      {meia_meia_enabled && isCombo && comboPizza1Id && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm">Meia-Meia?</Label>
                            <Switch 
                              checked={isPizza1HalfHalf} 
                              onCheckedChange={(checked) => {
                                setIsPizza1HalfHalf(checked);
                                if (!checked) setComboPizza1HalfId('');
                              }} 
                            />
                          </div>
                          {isPizza1HalfHalf && (
                            <Select value={comboPizza1HalfId} onValueChange={setComboPizza1HalfId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Segunda metade" />
                              </SelectTrigger>
                              <SelectContent>
                                {promotionalPizzas.filter(p => p.isActive && p.id !== comboPizza1Id).map(pizza => (
                                  <SelectItem key={pizza.id} value={pizza.id}>
                                    {pizza.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Pizza 2 - Multiple Pizzas Combos */}
                    {isComboFamilia && (
                      <div className="p-3 bg-secondary/30 rounded-lg">
                        <Label className="text-sm font-medium mb-2 block">
                          Pizza 2:
                        </Label>
                        <Select value={comboPizza2Id} onValueChange={setComboPizza2Id}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um sabor" />
                          </SelectTrigger>
                          <SelectContent>
                            {promotionalPizzas.filter(p => p.isActive).map(pizza => (
                              <SelectItem key={pizza.id} value={pizza.id}>
                                {pizza.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Half-Half for Pizza 2 */}
                        {meia_meia_enabled && comboPizza2Id && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm">Meia-Meia?</Label>
                              <Switch 
                                checked={isPizza2HalfHalf} 
                                onCheckedChange={(checked) => {
                                  setIsPizza2HalfHalf(checked);
                                  if (!checked) setComboPizza2HalfId('');
                                }} 
                              />
                            </div>
                            {isPizza2HalfHalf && (
                              <Select value={comboPizza2HalfId} onValueChange={setComboPizza2HalfId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Segunda metade" />
                                </SelectTrigger>
                                <SelectContent>
                                  {promotionalPizzas.filter(p => p.isActive && p.id !== comboPizza2Id).map(pizza => (
                                    <SelectItem key={pizza.id} value={pizza.id}>
                                      {pizza.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Drink Selection */}
              {showDrinkSelection && bebidas_enabled && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GlassWater className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">
                        Bebida {isCombo && <span className="text-green-600 font-normal">(grátis no combo)</span>}
                      </Label>
                    </div>
                    <Select value={selectedDrinkId} onValueChange={setSelectedDrinkId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha sua bebida" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem-bebida">Não quero bebida</SelectItem>
                        {availableDrinks.map(drink => (
                          <SelectItem key={drink.id} value={drink.id}>
                            {drink.name} {!isCombo && `(+${formatPrice(drink.price!)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isCombo && (
                      <p className="text-xs text-green-600 mt-2">
                        * Refrigerante grátis incluso no combo
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Quantity */}
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Quantidade</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold text-lg">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(calculateTotal())}
                </p>
              </div>
              
              <Button
                size="lg"
                className="w-full sm:w-auto btn-cta gap-2"
                onClick={handleAddToCart}
                disabled={isUnavailable}
              >
                <ShoppingCart className="w-5 h-5" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

