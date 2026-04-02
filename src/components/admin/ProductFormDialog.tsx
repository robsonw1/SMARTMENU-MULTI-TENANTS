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
  const [priceSmall, setPriceSmall] = useState<string>("");
  const [priceLarge, setPriceLarge] = useState<string>("");
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
    setPriceSmall(product.priceSmall != null ? String(product.priceSmall) : "");
    setPriceLarge(product.priceLarge != null ? String(product.priceLarge) : "");
    
    // ✅ NOVO: Pre-fill imagem se tiver
    if (product.image) {
      setExistingImageUrl(product.image);
      setEnableImages(true);
    } else {
      setExistingImageUrl(null);
      setEnableImages(false);
    }
  }, [open, product]);

  const reset = () => {
    setName("");
    setDescription("");
    setCategory("promocionais");
    setPrice("");
    setPriceSmall("");
    setIsPopular(false);
    setPriceLarge("");
    
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
        .from('pizzaria-products')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('❌ [UPLOAD] Erro ao enviar:', uploadError);
        toast.error(`Erro ao enviar imagem: ${uploadError.message}`);
        return null;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('pizzaria-products')
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
    const finalPriceSmall = isPizzaCategory ? toNumberOrUndefined(priceSmall) : undefined;
    const finalPriceLarge = isPizzaCategory ? toNumberOrUndefined(priceLarge) : undefined;

    // Validar que ao menos um preço foi preenchido
    if (!finalPrice && !finalPriceSmall && !finalPriceLarge) {
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="p-broto">Preço Broto</Label>
                <Input
                  id="p-broto"
                  value={priceSmall}
                  onChange={(e) => setPriceSmall(e.target.value)}
                  placeholder="Ex.: 49.99"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-grande">Preço Grande</Label>
                <Input
                  id="p-grande"
                  value={priceLarge}
                  onChange={(e) => setPriceLarge(e.target.value)}
                  placeholder="Ex.: 59.99"
                />
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
