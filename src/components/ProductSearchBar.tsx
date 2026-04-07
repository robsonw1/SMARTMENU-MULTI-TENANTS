import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProductSearchBarProps {
  products: Array<{ id: string; name: string; description?: string }>;
  onSearchChange: (filteredProductIds: string[]) => void;
  placeholder?: string;
}

export function ProductSearchBar({ products, onSearchChange, placeholder = 'Buscar produtos...' }: ProductSearchBarProps) {
  const [searchValue, setSearchValue] = useState('');

  // 🔍 Filtrar produtos em tempo real
  const filteredProductIds = useMemo(() => {
    if (!searchValue.trim()) {
      return products.map((p) => p.id);
    }

    const lowerSearch = searchValue.toLowerCase();
    return products
      .filter((product) => {
        const nameMatch = product.name.toLowerCase().includes(lowerSearch);
        const descriptionMatch = product.description?.toLowerCase().includes(lowerSearch) ?? false;
        return nameMatch || descriptionMatch;
      })
      .map((p) => p.id);
  }, [searchValue, products]);

  // 📢 Notificar quando resultados mudam
  useEffect(() => {
    onSearchChange(filteredProductIds);
  }, [filteredProductIds, onSearchChange]);

  const handleClear = () => {
    setSearchValue('');
  };

  return (
    <div className="relative w-full mb-4 sm:mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10 pr-10 rounded-lg border-2 border-primary/20 focus:border-primary focus:outline-none"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            onClick={handleClear}
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </div>
      
      {/* Mostrar contagem de resultados */}
      {searchValue && (
        <p className="text-xs text-muted-foreground mt-2">
          {filteredProductIds.length} produto{filteredProductIds.length !== 1 ? 's' : ''} encontrado{filteredProductIds.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
