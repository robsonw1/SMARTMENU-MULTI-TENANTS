import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, QrCode } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { useAppUrl } from '@/hooks/useAppUrl';

interface QRCodeDisplayProps {
  size?: 100 | 200 | 300 | 500 | 1000;
  showControls?: boolean;
  label?: string;
}

export function QRCodeDisplay({ size = 200, showControls = true, label }: QRCodeDisplayProps) {
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrSvgRef = useRef<HTMLDivElement>(null);
  const appUrl = useAppUrl(); // ✅ NOVO: Hook que detecta dinamicamente a URL

  const downloadQR = async (format: 'png' | 'svg') => {
    try {
      // Pequeno delay para garantir que o elemento foi renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      if (format === 'png') {
        if (!qrCanvasRef.current) {
          toast.error('Componente não foi encontrado');
          return;
        }
        const canvas = qrCanvasRef.current.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) {
          toast.error('Canvas não gerado. Tente novamente.');
          return;
        }

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `qrcode-forneiro-${size}x${size}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('✓ QR Code PNG baixado!');
      } else if (format === 'svg') {
        if (!qrSvgRef.current) {
          toast.error('Componente não foi encontrado');
          return;
        }
        const svgElement = qrSvgRef.current.querySelector('svg') as SVGElement | null;
        if (!svgElement) {
          toast.error('SVG não gerado. Tente novamente.');
          return;
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qrcode-forneiro-${size}x${size}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('✓ SVG baixado! Melhor para imprimir');
      }
    } catch (error) {
      console.error('Erro ao baixar QR Code:', error);
      toast.error('Erro ao processar download. Recarregue a página.');
    }
  };

  if (showControls) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code do App
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* QR Code Display (Canvas) */}
            <div className="flex justify-center p-8 bg-secondary rounded-lg">
              <div ref={qrCanvasRef}>
                <QRCodeCanvas
                  value={appUrl}
                  size={size}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            </div>

            {/* SVG hidden for download */}
            <div style={{ display: 'none' }} ref={qrSvgRef}>
              <QRCodeSVG
                value={appUrl}
                size={size}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* URL Info */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">URL do App:</p>
              <p className="text-sm font-mono break-all text-foreground">{appUrl}</p>
            </div>

            {/* Download Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Baixar QR Code ({size}×{size}px):</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => downloadQR('png')}
                  variant="default"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  PNG
                </Button>
                <Button
                  onClick={() => downloadQR('svg')}
                  variant="secondary"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  SVG
                </Button>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 rounded-lg">
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  ✨ <strong>SVG é melhor para imprimir:</strong> Redimensiona sem perder qualidade. Use em Canva, Photoshop, panfletos profissionais.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Modo simples (sem controles)
  return (
    <div ref={qrCanvasRef}>
      <QRCodeCanvas
        value={appUrl}
        size={size}
        level="H"
        includeMargin={true}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
}
