import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw } from "lucide-react";

interface QRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode?: string;
  instanceName?: string;
  onRegenerate?: () => void;
  isLoading?: boolean;
}

export default function QRModal({ 
  open, 
  onOpenChange, 
  qrCode, 
  instanceName, 
  onRegenerate,
  isLoading = false 
}: QRModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code - WhatsApp</DialogTitle>
        </DialogHeader>
        
        <div className="text-center">
          <div className="w-64 h-64 mx-auto bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center mb-4">
            {qrCode ? (
              <img 
                src={qrCode} 
                alt="QR Code" 
                className="w-full h-full object-contain"
                data-testid="qr-code-image"
              />
            ) : isLoading ? (
              <div className="text-center">
                <RefreshCw className="animate-spin text-4xl text-slate-400 mb-2 mx-auto" size={48} />
                <p className="text-slate-500">Gerando QR Code...</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="text-4xl text-slate-400 mb-2 mx-auto" size={48} />
                <p className="text-slate-500">QR Code será gerado aqui</p>
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
              Regenerar
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
