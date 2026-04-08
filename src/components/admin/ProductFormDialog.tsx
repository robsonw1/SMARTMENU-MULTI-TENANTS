import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { categoryLabels } from "@/data/products";
import { useCatalogStore } from "@/store/useCatalogStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  tenantId: string | null; // ✅ NOVO: Receber tenantId como prop
};

const categoryOptions = [
  "combos",
  "promocionais",
  "tradicionais",
  "premium",
  "especiais",
  "doces",
  "bebidas",
  "adicionais",
  "bordas",
] as const;

// ✅ IMPORTANTE: tenantId agora vem como prop, não precisa mais de useSecureTenantId()
export function ProductFormDialog({ open, onOpenChange, product, tenantId }: Props) {
  const upsertProduct = useCatalogStore((s) => s.upsertProduct);
  const settingsForm = useSettingsStore((s) => s.settings);

  // 🔄 Mapeamento dinâmico de categorias (lê de settings.categories_config)
  const dynamicCategoryLabels = useMemo(() => {
    const mapping: Record<string, string> = { ...categoryLabels };
    
    if (settingsForm.categories_config && Array.isArray(settingsForm.categories_config)) {
      settingsForm.categories_config.forEach((cat) => {
        mapping[cat.id] = cat.label;
      });
    }
    
    return mapping;
  }, [settingsForm.categories_config]);

  const isEdit = !!product;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Product["category"]>("promocionais");
  const [price, setPrice] = useState<string>("");
  // ✅ NOVO: Mapa dinâmico para armazenar preços de QUALQUER tamanho (customizados ou padrão)
  const [pricesBySize, setPricesBySize] = useState<Record<string, string>>({});
  const [isPopular, setIsPopular] = useState(false);
  
  // ✅ NOVO: Estados para upload de imagem
  const [enableImages, setEnableImages] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const isPizzaCategory = useMemo(
    () =>
      [
        "promocionais",
        "tradicionais",
        "premium",
        "especiais",
        "doces",
      ].includes(category as any),
    [category]
  );

  useEffect(() => {
    if (!open) return;
    if (!product) return;

    setName(product.name ?? "");
    setDescription(product.description ?? "");
    setCategory(product.category ?? "promocionais");
    setIsPopular(product.isPopular ?? false);

    // Pre-fill price fields based on product type
    setPrice(product.price != null ? String(product.price) : "");
    
    // ✅ NOVO: Preencher pricesBySize com os preços existentes do produto
    // Suportar tanto priceSmall/priceLarge (padrão) quanto custom sizes (pricesBySize novo)
    const sizePrices: Record<string, string> = {};
    
    // Se tem pricesBySize (novo sistema), usar como base
    if (product.pricesBySize && Object.keys(product.pricesBySize).length > 0) {
      Object.entries(product.pricesBySize).forEach(([sizeId, price]) => {
        sizePrices[sizeId] = String(price);
      });
    } else {
      // Fallback para sistema legado (priceSmall/priceLarge)
      // Se tem priceSmall, adicionar ao mapa com ID padrão 'broto'
      if (product.priceSmall != null) {
        sizePrices['broto'] = String(product.priceSmall);
      }
      
      // Se tem priceLarge, adicionar ao mapa com ID padrão 'grande'
      if (product.priceLarge != null) {
        sizePrices['grande'] = String(product.priceLarge);
      }
    }
    
    setPricesBySize(sizePrices);
    
    // ✅ NOVO: Pre-fill imagem se tiver
    if (product.image) {
      setExistingImageUrl(product.image);
      setEnableImages(true);
    } else {
      setExistingImageUrl(null);
      setEnableImages(false);
    }
  }, [open, product]);

  // ✅ NOVO (07/04/2026): UseEffect para sincronizar pricesBySize quando sizes_config muda
  // Isso garante que quando novos tamanhos são adicionados via "Gerenciar Tamanhos",
  // os inputs aparecem e funcionam corretamente no ProductFormDialog
  useEffect(() => {
    if (!open) return;
    if (!isPizzaCategory) return;
    
    // Se não há sizes_config ou está vazio, não fazer nada
    if (!settingsForm.sizes_config || settingsForm.sizes_config.length === 0) {
      return;
    }

    // Garantir que pricesBySize tem entradas para todos os tamanhos ativos
    // Mantém valores já digitados mas adiciona tamanhos novos
    const updatedPrices: Record<string, string> = { ...pricesBySize };
    
    settingsForm.sizes_config.forEach((size: any) => {
      if (size.isActive && !updatedPrices.hasOwnProperty(size.id)) {
        // Novo tamanho foi adicionado, mas não tem preço yet
        updatedPrices[size.id] = '';
      }
    });

    // Só atualizar se houve mudança (evita re-renders desnecessários)
    if (Object.keys(updatedPrices).length > Object.keys(pricesBySize).length) {
      setPricesBySize(updatedPrices);
    }
  }, [open, settingsForm.sizes_config, isPizzaCategory, pricesBySize]);

  const reset = () => {
    setName("");
    setDescription("");
    setCategory("promocionais");
    setPrice("");
    // ✅ NOVO: Reset pricesBySize (mapa dinâmico)
    setPricesBySize({});
    setIsPopular(false);
    
    // ✅ NOVO: Reset image states
    setEnableImages(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingImageUrl(null);
  };

  // ✅ NOVO: Handler para seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Apenas PNG ou JPEG são permitidos');
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // ✅ NOVO: Upload para Supabase Storage
  const uploadImageToStorage = async (file: File, pId: string): Promise<string | null> => {
    if (!tenantId) {
      toast.error('Tenant ID não encontrado');
      return null;
    }

    try {
      setUploading(true);
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${pId}-${timestamp}.${fileExt}`;
      const filePath = `products/${tenantId}/${fileName}`;

      console.log(`📤 [UPLOAD] Iniciando upload: ${filePath}`);

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('tenant-products')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('❌ [UPLOAD] Erro ao enviar:', uploadError);
        toast.error(`Erro ao enviar imagem: ${uploadError.message}`);
        return null;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('tenant-products')
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl;
      console.log(`✅ [UPLOAD] Sucesso! URL: ${publicUrl}`);
      setUploading(false);
      return publicUrl || null;
    } catch (error) {
      console.error('❌ [UPLOAD] Erro:', error);
      toast.error('Erro ao fazer upload da imagem');
      setUploading(false);
      return null;
    }
  };

  // ✅ NOVO: Remover imagem selecionada
  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const toNumberOrUndefined = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!tenantId) {
      toast.error('Tenant ID não encontrado. Por favor, acesse novamente.');
      return;
    }

    // Determinar preços baseado na categoria
    const finalPrice = !isPizzaCategory ? toNumberOrUndefined(price) : undefined;
    
    // ✅ NOVO: Extrair preços do mapa dinâmico pricesBySize
    // Se for categoria pizza, converter os preços do mapa para priceSmall/priceLarge
    let finalPriceSmall: number | undefined;
    let finalPriceLarge: number | undefined;
    // ✅ NOVO (07/04/2026): Converter TODOS os pricesBySize para números
    const finalPricesBySize: Record<string, number> = {};
    
    if (isPizzaCategory) {
      // Converter todos os preços do mapa de string para number
      Object.entries(pricesBySize).forEach(([sizeId, priceStr]) => {
        const priceNum = toNumberOrUndefined(priceStr);
        if (priceNum !== undefined) {
          finalPricesBySize[sizeId] = priceNum;
        }
      });
      
      // Buscar 'broto' e 'grande' do mapa (IDs padrão) para compatibilidade legada
      finalPriceSmall = finalPricesBySize['broto'];
      finalPriceLarge = finalPricesBySize['grande'];
    }

    // Validar que ao menos um preço foi preenchido
    if (!finalPrice && Object.keys(finalPricesBySize).length === 0) {
      toast.error('Preencha o preço do produto');
      return;
    }

    const nextProduct: Product = {
      ...(product ?? {
        id: `custom-${Date.now()}`,
        ingredients: [],
        isActive: true,
      }),
      name: trimmed,
      description: description.trim(),
      category,
      price: finalPrice,
      isPopular,
      priceSmall: finalPriceSmall,
      priceLarge: finalPriceLarge,
      // ✅ NOVO: Guardar TODOS os preços customizados
      pricesBySize: Object.keys(finalPricesBySize).length > 0 ? finalPricesBySize : undefined,
    };

    // ✅ NOVO: Upload de imagem se selecionada
    let finalImageUrl = existingImageUrl;
    if (enableImages && selectedFile) {
      const uploadedUrl = await uploadImageToStorage(selectedFile, nextProduct.id);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      } else {
        return; // Cancelar se upload falhar
      }
    } else if (!enableImages) {
      // Se toggle foi desativado, remover imagem
      finalImageUrl = null;
    }

    // Atualizar com imagem
    if (finalImageUrl) {
      nextProduct.image = finalImageUrl;
    }

    // Atualizar estado local (Zustand)
    upsertProduct(nextProduct);

    // Salvar no Supabase com formato JSONB correto
    try {
      // ✅ SEMPRE enviar TODOS os campos de preço (mesmo que null)
      // Isso garante que Supabase sobrescreve qualquer valor antigo ou inválido
      const dataJson: any = {
        description: nextProduct.description,
        category: nextProduct.category,
        price: nextProduct.price ?? null,
        price_small: nextProduct.priceSmall ?? null,
        price_large: nextProduct.priceLarge ?? null,
        // ✅ NOVO: Incluir mapa completo de preços customizados
        prices_by_size: nextProduct.pricesBySize ?? null,
        ingredients: nextProduct.ingredients || [],
        image: finalImageUrl || undefined,
        is_active: nextProduct.isActive !== false,
        is_popular: nextProduct.isPopular || false,
        is_vegetarian: nextProduct.isVegetarian || false,
        is_customizable: nextProduct.isCustomizable || false,
        is_new: nextProduct.isNew || false,
      };

      const { error } = await (supabase as any)
        .from('products')
        .upsert({
          id: nextProduct.id,
          name: nextProduct.name,
          data: dataJson,
          tenant_id: tenantId,
        }, { onConflict: 'id' });

      if (error) {
        toast.error('Erro ao salvar produto no banco');
        console.error('Erro Supabase:', error);
        return;
      }

      console.log(`✅ [SAVE] Produto ${nextProduct.id} salvo com imagem: ${finalImageUrl}`);
      toast.success(isEdit ? 'Produto atualizado!' : 'Produto criado!');
    } catch (error) {
      toast.error('Erro ao salvar produto');
      console.error(error);
      return;
    }

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <div className="px-4 grid gap-4 max-h-[calc(90vh-180px)] overflow-y-auto overflow-x-hidden scrollbar-gutter-stable">
          {/* ✅ NOVO: Toggle para adicionar imagem (no TOPO) */}
          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors bg-secondary/30">
            <div>
              <Label className="text-base font-medium cursor-pointer">Adicionar Imagem</Label>
              <p className="text-xs text-muted-foreground">PNG ou JPEG • Recomendado: 600x400px</p>
            </div>
            <Switch 
              checked={enableImages} 
              onCheckedChange={(checked) => {
                setEnableImages(checked);
                if (!checked) {
                  handleRemoveImage();
                }
              }}
            />
          </div>

          {/* ✅ NOVO: Upload field (condicional) */}
          {enableImages && (
            <div className="grid gap-3 p-3 border-2 border-dashed rounded-lg bg-secondary/10">
              {/* Preview existente */}
              {(previewUrl || existingImageUrl) && (
                <div className="relative w-full">
                  <img
                    src={previewUrl || existingImageUrl || ''}
                    alt="preview"
                    className="w-full h-40 object-cover rounded-md border"
                  />
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Upload input */}
              <label className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-primary/5 hover:border-primary'
              }`}>
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Enviando...' : !selectedFile && !existingImageUrl ? 'Clique para selecionar' : 'Clique para trocar'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="p-name">Nome</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Calabresa"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-desc">Descrição</Label>
            <Input
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Mussarela, calabresa fatiada e cebola"
            />
          </div>

          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {dynamicCategoryLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPizzaCategory ? (
            <div className="space-y-4">
              {/* ✅ NOVO: Renderizar campos de preço dinamicamente baseado em sizes_config */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Preços por Tamanho</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(settingsForm.sizes_config && settingsForm.sizes_config.filter((s: any) => s.isActive).length > 0 
                    ? settingsForm.sizes_config.filter((s: any) => s.isActive)
                    : [
                        { id: 'broto', name: 'Broto', description: '4 fatias', isActive: true, order: 0 },
                        { id: 'grande', name: 'Grande', description: '8 fatias', isActive: true, order: 1 }
                      ]
                  ).map((sizeConfig: any, index: number) => (
                    <div key={sizeConfig.id} className="grid gap-2">
                      <Label htmlFor={`p-size-${sizeConfig.id}`}>
                        Preço {sizeConfig.name}
                        <span className="text-xs text-muted-foreground ml-1">({sizeConfig.description})</span>
                      </Label>
                      <Input
                        id={`p-size-${sizeConfig.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricesBySize[sizeConfig.id] || ""}
                        onChange={(e) => {
                          setPricesBySize((prev) => ({
                            ...prev,
                            [sizeConfig.id]: e.target.value
                          }));
                        }}
                        placeholder="Ex.: 49.99"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Defina os preços para cada tamanho disponível
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="p-preco">Preço</Label>
              <Input
                id="p-preco"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex.: 9.99"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="p-popular">Marcar como Popular</Label>
            <Switch
              id="p-popular"
              checked={isPopular}
              onCheckedChange={setIsPopular}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="btn-cta" onClick={handleSave} disabled={!name.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
