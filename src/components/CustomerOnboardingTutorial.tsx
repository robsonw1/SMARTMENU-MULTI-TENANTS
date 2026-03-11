import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface CustomerOnboardingTutorialProps {
  isOpen: boolean;
  currentStep: number;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    target?: string;
  }>;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function CustomerOnboardingTutorial({
  isOpen,
  currentStep,
  steps,
  onNext,
  onPrev,
  onSkip,
  isLoading = false,
}: CustomerOnboardingTutorialProps) {
  if (!isOpen || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl">{step.title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSkip}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 py-6"
        >
          {/* Descrição */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
            <p className="text-base text-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Indicador Visual */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Etapa {currentStep + 1} de {steps.length}
              </span>
              <span className="font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Indicadores de dots */}
          <div className="flex gap-1.5 justify-center">
            {steps.map((_, index) => (
              <button
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-primary w-6'
                    : index < currentStep
                      ? 'bg-primary/50 w-2'
                      : 'bg-muted w-2'
                }`}
                onClick={() => {
                  // Permitir navegação entre steps já vistos
                  if (index <= currentStep) {
                    // Apenas voltar, não avançar
                    for (let i = currentStep; i > index; i--) {
                      // Usar onPrev múltiplas vezes
                    }
                  }
                }}
              />
            ))}
          </div>
        </motion.div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            {/* Botão Voltar */}
            <Button
              variant="outline"
              onClick={onPrev}
              disabled={isFirstStep || isLoading}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {/* Botão Próximo ou Concluir */}
            <Button
              onClick={onNext}
              disabled={isLoading}
              className="flex-1"
            >
              {isLastStep ? (
                <>
                  Concluir
                  <X className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Botão Pular (abaixo) */}
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
            className="w-full text-xs"
          >
            Pular Tutorial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
