import { useState, useMemo } from 'react';
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
import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import {
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
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_OPTIONS = {
  Gift: { name: 'Gift', component: Gift },
  Tag: { name: 'Tag', component: Tag },
  Pizza: { name: 'Pizza', component: Pizza },
  Crown: { name: 'Crown', component: Crown },
  Star: { name: 'Star', component: Star },
  Cake: { name: 'Cake', component: Cake },
  GlassWater: { name: 'GlassWater', component: GlassWater },
  Heart: { name: 'Heart', component: Heart },
  Zap: { name: 'Zap', component: Zap },
  Utensils: { name: 'Utensils', component: Utensils },
  Leaf: { name: 'Leaf', component: Leaf },
  Coffee: { name: 'Coffee', component: Coffee },
};

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryConfig[];
  onSave: (categories: CategoryConfig[]) => void;
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
  categories,
  onSave,
}: CategoryManagementDialogProps) {
  const [editingCategories, setEditingCategories] = useState<CategoryConfig[]>(categories);

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

  const handleSave = () => {
    const enabledCount = editingCategories.filter((c) => c.enabled).length;
    if (enabledCount === 0) {
      toast.error('❌ Pelo menos 1 categoria deve estar ativada!');
      return;
    }
    onSave(editingCategories);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias do Cardápio</DialogTitle>
        </DialogHeader>

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
                      disabled={idx === 0}
                      className="p-1 hover:bg-secondary disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <button
                      onClick={() => moveDown(category.id)}
                      disabled={idx === sortedCategories.length - 1}
                      className="p-1 hover:bg-secondary disabled:opacity-30"
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
                      className="h-8"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div className="w-32">
                    <Label className="text-xs text-muted-foreground">Ícone</Label>
                    <Select
                      value={category.icon_name}
                      onValueChange={(value) =>
                        updateCategory(category.id, { icon_name: value })
                      }
                    >
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
                    className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Categorias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
