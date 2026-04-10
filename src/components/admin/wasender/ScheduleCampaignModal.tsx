import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Clock } from 'lucide-react';

interface ScheduleData {
  scheduleName: string;
  scheduledDate: string;
  scheduledHour: number;
}

interface ScheduleCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ScheduleData) => void;
  isLoading?: boolean;
}

export function ScheduleCampaignModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ScheduleCampaignModalProps) {
  const [scheduleName, setScheduleName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [scheduledHour, setScheduledHour] = useState(20);

  const handleConfirm = () => {
    if (!scheduleName.trim()) {
      alert('Digite o nome do agendamento');
      return;
    }

    onConfirm({
      scheduleName,
      scheduledDate,
      scheduledHour,
    });

    // Reset form
    setScheduleName('');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledHour(20);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Campanha</DialogTitle>
          <DialogDescription>
            Configure data e hora para disparar automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Schedule Name */}
          <div>
            <Label>Nome do Agendamento</Label>
            <Input
              placeholder="Ex: Black Friday - Sexta 20h"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Identificação deste agendamento
            </p>
          </div>

          {/* Date */}
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data
            </Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mt-1"
            />
          </div>

          {/* Hour */}
          <div>
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Horário
            </Label>
            <div className="mt-1 flex gap-2">
              <select
                value={scheduledHour}
                onChange={(e) => setScheduledHour(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💡 Melhor horário: 20h-21h (maior engajamento)
            </p>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Agendado para:</strong>
              <br />
              {scheduledDate} às {String(scheduledHour).padStart(2, '0')}:00
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Agendando...' : 'AGENDE AGORA'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
