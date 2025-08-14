import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface QRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode?: string;
  instanceName?: string;
  onRegenerate?: () => void;
  isLoading?: boolean;
  message?: string;
}

export default function QRModal({ 
  open, 
  onOpenChange, 
  qrCode, 
  instanceName, 
  onRegenerate,
  isLoading = false,
  message 
}: QRModalProps) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return 95; // Stop at 95% to avoid false completion
          return prev + Math.random() * 15; // Random increment
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isLoading]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code - WhatsApp</DialogTitle>
        </DialogHeader>
        
        <div className="text-center">
          <div className="w-64 h-64 mx-auto bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center mb-4">
            {qrCode ? (
              <img 
                src={`data:image/png;base64,${qrCode}`}
                alt="QR Code" 
                className="w-full h-full object-contain p-2"
                data-testid="qr-code-image"
              />
            ) : isLoading ? (
              <div className="text-center">
                <RefreshCw className="animate-spin text-4xl text-slate-400 mb-4 mx-auto" size={48} />
                <p className="text-slate-500 mb-3">Aguardando QR Code...</p>
                <Progress value={progress} className="w-48 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Instâncias novas podem levar até 30 segundos
                </p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="text-4xl text-slate-400 mb-2 mx-auto" size={48} />
                <div className={`text-sm ${message && (message.includes('stuck') || message.includes('travada')) ? 'text-red-600' : 'text-slate-500'}`}>
                  {message || "Clique em \"Gerar QR Code\" para começar"}
                </div>
                {message && (message.includes('stuck') || message.includes('travada')) && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
                    <p className="text-xs text-red-700">
                      💡 <strong>Dica:</strong> Delete esta instância e crie uma nova para resolver o problema.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <p className="text-sm text-slate-600 mb-4">
            Escaneie o QR Code com o WhatsApp para conectar a instância
            {instanceName && ` "${instanceName}"`}
          </p>
          
          <div className="flex space-x-3">
            <Button 
              className="flex-1" 
              onClick={onRegenerate}
              disabled={isLoading}
              data-testid="button-regenerate-qr"
            >
              <RefreshCw size={16} className="mr-2" />
              {qrCode ? "Regenerar" : "Gerar QR Code"}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={() => onOpenChange(false)}
              data-testid="button-close-qr-modal"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
