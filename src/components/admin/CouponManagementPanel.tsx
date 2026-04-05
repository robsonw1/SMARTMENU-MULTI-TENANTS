import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, Plus, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useCouponManagementStore } from '@/store/useCouponManagementStore';
import { toast as sonnerToast } from 'sonner';

const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
};

export function CouponManagementPanel() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState('10');
  const [validDays, setValidDays] = useState('7');
  const [maxUsage, setMaxUsage] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { coupons, loading, getCoupons, createCoupon, deleteCoupon } =
    useCouponManagementStore();

  useEffect(() => {
    getCoupons();
  }, [getCoupons]);

  const handleCreateCoupon = async () => {
    if (!discountPercentage || isNaN(Number(discountPercentage))) {
      toast.error('Percentual de desconto inválido');
      return;
    }

    if (!validDays || isNaN(Number(validDays))) {
      toast.error('Dias de validade inválido');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createCoupon(
        Number(discountPercentage),
        Number(validDays),
        maxUsage ? Number(maxUsage) : undefined,
        description
      );

      if (result) {
        toast.success('Cupom criado com sucesso! 🎉');
        // Resetar formulário
        setDiscountPercentage('10');
        setValidDays('7');
        setMaxUsage('');
        setDescription('');
        setIsDialogOpen(false);
      } else {
        toast.error('Erro ao criar cupom');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (confirm('Tem certeza que deseja deletar este cupom?')) {
      const result = await deleteCoupon(couponId);
      if (result) {
        toast.success('Cupom deletado');
      } else {
        toast.error('Erro ao deletar cupom');
      }
    }
  };

  const handleCopyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado! 📋');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getDaysUntilExpiration = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Criar Cupom */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Criar Novo Cupom de Promoção
          </CardTitle>
          <CardDescription>
            Configure o desconto, validade e descrição do cupom
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Desconto (%)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Válido por (dias)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  placeholder="Ex: 7"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Uso Máximo (opcional)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Descrição/Motivo (opcional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Black Friday, Cliente VIP, Promoção de Verão..."
              />
            </div>

            <Button
              onClick={handleCreateCoupon}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Criando...' : '✨ Gerar Cupom'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
