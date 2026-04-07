import { useState, useMemo, useEffect } from 'react';
import { SizeConfig } from '@/store/useSettingsStore';
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
import { Card } from '@/components/ui/card';
import { Trash2, GripVertical, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface SizeManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sizes: SizeConfig[];
  onSave: (sizes: SizeConfig[]) => void;
  onSaveAsync?: (sizes: SizeConfig[]) => Promise<void>; // ✅ NOVO: Para salvar diretamente no DB
}

export function SizeManagementDialog({
  open,
  onOpenChange,
  sizes,
  onSave,
  onSaveAsync,
}: SizeManagementDialogProps) {
  const [editingSizes, setEditingSizes] = useState<SizeConfig[]>(sizes || []);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeDescription, setNewSizeDescription] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // ✅ NOVO: Loading state durante persist

  // 🔄 Sincronizar com sizes quando abrem a dialog
  useEffect(() => {
    if (open) {
      setEditingSizes(sizes || []);
      setIsAddingNew(false);
      setNewSizeName('');
      setNewSizeDescription('');
    }
  }, [open, sizes]);

  const sortedSizes = useMemo(
    () => [...editingSizes].sort((a, b) => a.order - b.order),
    [editingSizes]
  );

  const updateSize = (id: string, updates: Partial<SizeConfig>) => {
    setEditingSizes((prev) =>
      prev.map((size) => (size.id === id ? { ...size, ...updates } : size))
    );
  };

  const moveUp = (id: string) => {
    const idx = sortedSizes.findIndex((s) => s.id === id);
    if (idx > 0) {
      const swapId = sortedSizes[idx - 1].id;
      setEditingSizes((prev) =>
        prev.map((size) => {
          if (size.id === id) return { ...size, order: size.order - 1 };
          if (size.id === swapId) return { ...size, order: size.order + 1 };
          return size;
        })
      );
    }
  };

  const moveDown = (id: string) => {
    const idx = sortedSizes.findIndex((s) => s.id === id);
    if (idx < sortedSizes.length - 1) {
      const swapId = sortedSizes[idx + 1].id;
      setEditingSizes((prev) =>
        prev.map((size) => {
          if (size.id === id) return { ...size, order: size.order + 1 };
          if (size.id === swapId) return { ...size, order: size.order - 1 };
          return size;
        })
      );
    }
  };

  const deleteSize = (id: string) => {
    const enabledCount = editingSizes.filter((s) => s.isActive).length;
    if (editingSizes.find((s) => s.id === id)?.isActive && enabledCount === 1) {
      toast.error('❌ Pelo menos 1 tamanho deve estar ativado!');
      return;
    }
    setEditingSizes((prev) => prev.filter((size) => size.id !== id));
    toast.success('✅ Tamanho removido');
  };

  const addNewSize = () => {
    if (editingSizes.length >= 9) {
      toast.error('❌ Máximo 9 tamanhos permitidos!');
      return;
    }

    const trimmedName = newSizeName.trim();
    if (!trimmedName) {
      toast.error('❌ Nome não pode ser vazio!');
      return;
    }

    if (trimmedName.length > 30) {
      toast.error('❌ Nome deve ter máximo 30 caracteres!');
      return;
    }

    if (editingSizes.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('❌ Já existe um tamanho com este nome!');
      return;
    }

    const maxOrder = Math.max(...editingSizes.map((s) => s.order), -1);
    const newSize: SizeConfig = {
      id: `size_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      description: newSizeDescription.trim(),
      isActive: true,
      order: maxOrder + 1,
    };

    setEditingSizes((prev) => [...prev, newSize]);
    setNewSizeName('');
    setNewSizeDescription('');
    setIsAddingNew(false);
    toast.success(`✅ "${trimmedName}" adicionado!`);
  };

  const handleSave = async () => {
    const enabledCount = editingSizes.filter((s) => s.isActive).length;
    if (enabledCount === 0) {
      toast.error('❌ Pelo menos 1 tamanho deve estar ativado!');
      return;
    }

    // ✅ NOVO: Se onSaveAsync fornecido, persiste diretamente no DB
    if (onSaveAsync) {
      setIsSaving(true);
      try {
        await onSaveAsync(editingSizes);
        toast.success('✅ Tamanhos salvos com sucesso em tempo real!');
        onOpenChange(false);
      } catch (error) {
        console.error('❌ Erro ao salvar tamanhos:', error);
        toast.error('❌ Erro ao salvar tamanhos. Verifique a conexão.');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Fallback: usar padrão antigo (apenas marca como alterado)
      onSave(editingSizes);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden scrollbar-gutter-stable">
        <DialogHeader className="flex flex-row items-center justify-between pr-4">
          <DialogTitle>Gerenciar Tamanhos</DialogTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="gap-2"
            disabled={editingSizes.length >= 9}
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </DialogHeader>

        {/* 📝 Formulário para adicionar novo tamanho */}
        {isAddingNew && (
          <Card className="p-4 bg-secondary/30 border-dashed">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nome do Tamanho</Label>
                <Input
                  placeholder="Ex: Pequeno, Médio, Grande..."
                  value={newSizeName}
                  onChange={(e) => setNewSizeName(e.target.value.slice(0, 30))}
                  maxLength={30}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addNewSize();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newSizeName.length}/30
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input
                  placeholder="Ex: 4 fatias, 300ml, 500g..."
                  value={newSizeDescription}
                  onChange={(e) => setNewSizeDescription(e.target.value.slice(0, 50))}
                  maxLength={50}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addNewSize();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newSizeDescription.length}/50
                </p>
              </div>

              <Button
                onClick={addNewSize}
                size="sm"
                className="w-full"
              >
                Criar Tamanho
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {sortedSizes.map((size, idx) => (
            <Card key={size.id} className="p-4">
              <div className="flex items-center gap-4">
                {/* Grip & Reorder */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveUp(size.id)}
                    disabled={idx === 0}
                    className="p-1 hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <button
                    onClick={() => moveDown(size.id)}
                    disabled={idx === sortedSizes.length - 1}
                    className="p-1 hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Nome Input */}
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={size.name}
                    onChange={(e) =>
                      updateSize(size.id, { name: e.target.value.slice(0, 30) })
                    }
                    placeholder="Ex: Pequeno"
                    className="h-8"
                  />
                </div>

                {/* Descrição Input */}
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Input
                    value={size.description}
                    onChange={(e) =>
                      updateSize(size.id, { description: e.target.value.slice(0, 50) })
                    }
                    placeholder="Ex: 4 fatias"
                    className="h-8"
                  />
                </div>

                {/* Ativo/Inativo */}
                <div className="flex flex-col items-center justify-end gap-2">
                  <Label className="text-xs text-muted-foreground">Ativo</Label>
                  <Switch
                    checked={size.isActive}
                    onCheckedChange={(checked) =>
                      updateSize(size.id, { isActive: checked })
                    }
                  />
                </div>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSize(size.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button className="btn-cta" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '⏳ Salvando...' : '💾 Salvar Tamanhos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
