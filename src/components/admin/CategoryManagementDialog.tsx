import { useState, useMemo, useEffect } from 'react';
import { CategoryConfig } from '@/store/useSettingsStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Trash2, GripVertical, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import {
  Gift,
  Tag,
  ShoppingBag,
  Crown,
  Star,
  Cake,
  GlassWater,
  Heart,
  Zap,
  Utensils,
  Leaf,
  Coffee,
  Grid3x3,
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_OPTIONS = {
  Gift: { name: 'Gift', component: Gift },
  Tag: { name: 'Tag', component: Tag },
  Product: { name: 'Produto', component: ShoppingBag },
  Crown: { name: 'Crown', component: Crown },
  Star: { name: 'Star', component: Star },
  Cake: { name: 'Cake', component: Cake },
  GlassWater: { name: 'GlassWater', component: GlassWater },
  Heart: { name: 'Heart', component: Heart },
  Zap: { name: 'Zap', component: Zap },
  Utensils: { name: 'Utensils', component: Utensils },
  Leaf: { name: 'Leaf', component: Leaf },
  Coffee: { name: 'Coffee', component: Coffee },
  Grid3x3: { name: 'Grid3x3', component: Grid3x3 },
};

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryConfig[];
  onSave: (categories: CategoryConfig[]) => void;
  onSaveAsync?: (categories: CategoryConfig[]) => Promise<void>; // ✅ NOVO: Para salvar diretamente no DB
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
  categories,
  onSave,
  onSaveAsync,
}: CategoryManagementDialogProps) {
  const [editingCategories, setEditingCategories] = useState<CategoryConfig[]>(categories || []);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<keyof typeof ICON_OPTIONS>('Gift');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // ✅ NOVO: Loading state durante persist

  // 🔄 Sincronizar com categories quando abrem a dialog
  useEffect(() => {
    if (open) {
      setEditingCategories(categories || []);
      setIsAddingNew(false);
      setNewCategoryName('');
      setNewCategoryIcon('Gift');
    }
  }, [open, categories]);

  const sortedCategories = useMemo(
    () => [...editingCategories].sort((a, b) => a.order - b.order),
    [editingCategories]
  );

  const updateCategory = (id: string, updates: Partial<CategoryConfig>) => {
    setEditingCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat))
    );
  };

  const moveUp = (id: string) => {
    const idx = sortedCategories.findIndex((c) => c.id === id);
    if (idx > 0) {
      const swapId = sortedCategories[idx - 1].id;
      setEditingCategories((prev) =>
        prev.map((cat) => {
          if (cat.id === id) return { ...cat, order: cat.order - 1 };
          if (cat.id === swapId) return { ...cat, order: cat.order + 1 };
          return cat;
        })
      );
    }
  };

  const moveDown = (id: string) => {
    const idx = sortedCategories.findIndex((c) => c.id === id);
    if (idx < sortedCategories.length - 1) {
      const swapId = sortedCategories[idx + 1].id;
      setEditingCategories((prev) =>
        prev.map((cat) => {
          if (cat.id === id) return { ...cat, order: cat.order + 1 };
          if (cat.id === swapId) return { ...cat, order: cat.order - 1 };
          return cat;
        })
      );
    }
  };

  const deleteCategory = (id: string) => {
    const enabledCount = editingCategories.filter((c) => c.enabled).length;
    if (editingCategories.find((c) => c.id === id)?.enabled && enabledCount === 1) {
      toast.error('❌ Pelo menos 1 categoria deve estar ativada!');
      return;
    }
    setEditingCategories((prev) => prev.filter((cat) => cat.id !== id));
    toast.success('✅ Categoria removida');
  };

  const addNewCategory = () => {
    if (editingCategories.length >= 20) {
      toast.error('❌ Máximo 20 categorias permitidas!');
      return;
    }

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast.error('❌ Nome não pode ser vazio!');
      return;
    }

    if (trimmedName.length > 30) {
      toast.error('❌ Nome deve ter máximo 30 caracteres!');
      return;
    }

    if (editingCategories.some((c) => c.label.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('❌ Já existe uma categoria com este nome!');
      return;
    }

    const maxOrder = Math.max(...editingCategories.map((c) => c.order), -1);
    const newCategory: CategoryConfig = {
      id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: trimmedName,
      icon_name: newCategoryIcon,
      enabled: true,
      order: maxOrder + 1,
    };

    setEditingCategories((prev) => [...prev, newCategory]);
    setNewCategoryName('');
    setNewCategoryIcon('Gift');
    setIsAddingNew(false);
    toast.success(`✅ "${trimmedName}" adicionada!`);
  };

  const handleSave = async () => {
    const enabledCount = editingCategories.filter((c) => c.enabled).length;
    if (enabledCount === 0) {
      toast.error('❌ Pelo menos 1 categoria deve estar ativada!');
      return;
    }

    // ✅ NOVO: Se onSaveAsync fornecido, persiste diretamente no DB
    if (onSaveAsync) {
      setIsSaving(true);
      try {

        await onSaveAsync(editingCategories);
        toast.success('✅ Categorias salvas com sucesso em tempo real!');
        onOpenChange(false);
      } catch (error) {
        console.error('❌ Erro ao salvar categorias:', error);
        toast.error('❌ Erro ao salvar categorias. Verifique a conexão.');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Fallback: usar padrão antigo (apenas marca como alterado)
      onSave(editingCategories);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden scrollbar-gutter-stable">
        <DialogHeader className="flex flex-row items-center justify-between pr-4">
          <DialogTitle>Gerenciar Categorias do Cardápio</DialogTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="gap-2"
            disabled={editingCategories.length >= 20}
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </DialogHeader>

        {/* 📝 Formulário para adicionar nova categoria */}
        {isAddingNew && (
          <Card className="p-4 bg-secondary/30 border-dashed">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nome da Categoria</Label>
                <Input
                  placeholder="Ex: Bebidas Alcoólicas..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value.slice(0, 30))}
                  maxLength={30}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addNewCategory();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newCategoryName.length}/30
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Ícone</Label>
                  <Select value={newCategoryIcon} onValueChange={(value: any) => setNewCategoryIcon(value)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(ICON_OPTIONS).map((iconKey) => (
                        <SelectItem key={iconKey} value={iconKey}>
                          {iconKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={addNewCategory}
                  size="sm"
                  className="col-span-2 mt-6"
                >
                  Criar Categoria
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {sortedCategories.map((category, idx) => {
            const IconComponent = ICON_OPTIONS[category.icon_name as keyof typeof ICON_OPTIONS];
            const Icon = IconComponent?.component || Gift;

            return (
              <Card key={category.id} className="p-4">
                <div className="flex items-center gap-4">
                  {/* Grip & Reorder */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveUp(category.id)}
                      disabled={idx === 0 || category.id === 'todos'} // 🔒 BLOQUEAR move de "Todos"
                      className="p-1 hover:bg-secondary disabled:opacity-30"
                      title={category.id === 'todos' ? '❌ Categoria "Todos" deve estar sempre no início' : ''}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <button
                      onClick={() => moveDown(category.id)}
                      disabled={idx === sortedCategories.length - 1 || category.id === 'todos'} // 🔒 BLOQUEAR move de "Todos"
                      className="p-1 hover:bg-secondary disabled:opacity-30"
                      title={category.id === 'todos' ? '❌ Categoria "Todos" deve estar sempre no início' : ''}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon Preview */}
                  <div className="p-2 bg-secondary rounded">
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Label Input */}
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input
                      value={category.label}
                      onChange={(e) =>
                        updateCategory(category.id, { label: e.target.value })
                      }
                      disabled={category.id === 'todos'} // 🔒 BLOQUEAR edição de "Todos"
                      className="h-8"
                      title={category.id === 'todos' ? '❌ Categoria "Todos" padrão (não pode ser alterada)' : ''}
                    />
                  </div>

                  {/* Icon Selector */}
                  <div className="w-32">
                    <Label className="text-xs text-muted-foreground">Ícone</Label>
                    <Select
                      value={category.icon_name}
                      onValueChange={(value) =>
                        category.id !== 'todos' && // 🔒 BLOQUEAR para "Todos"
                        updateCategory(category.id, { icon_name: value })
                      }
                      disabled={category.id === 'todos'} // 🔒 BLOQUEAR Select
                    >
                      <SelectTrigger className="h-8" title={category.id === 'todos' ? '❌ Categoria "Todos" padrão (não pode ser alterada)' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ICON_OPTIONS).map((iconKey) => (
                          <SelectItem key={iconKey} value={iconKey}>
                            {iconKey}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Toggle Enabled */}
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Ativa</Label>
                    <Switch
                      checked={category.enabled}
                      onCheckedChange={(value) =>
                        updateCategory(category.id, { enabled: value })
                      }
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => deleteCategory(category.id)}
                    disabled={category.id === 'todos'} // 🔒 BLOQUEAR delete de "Todos"
                    className={`p-2 rounded transition-colors ${
                      category.id === 'todos'
                        ? 'opacity-30 cursor-not-allowed text-gray-400'
                        : 'text-destructive hover:bg-destructive/10'
                    }`}
                    title={category.id === 'todos' ? '❌ Categoria padrão não pode ser deletada' : 'Deletar'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {editingCategories.filter((c) => c.enabled).length === 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
            ⚠️ Pelo menos 1 categoria deve estar ativada!
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '⏳ Salvando...' : '💾 Salvar Categorias'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
