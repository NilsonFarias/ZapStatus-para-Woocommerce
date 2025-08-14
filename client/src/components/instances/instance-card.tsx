import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsappInstance } from "@shared/schema";
import { Smartphone, QrCode, Settings, Trash2 } from "lucide-react";

interface InstanceCardProps {
  instance: WhatsappInstance;
  onShowQR: (instance: WhatsappInstance) => void;
  onDelete: (instance: WhatsappInstance) => void;
}

export default function InstanceCard({ instance, onShowQR, onDelete }: InstanceCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-success/10 text-success';
      case 'disconnected':
        return 'bg-error/10 text-error';
      case 'connecting':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-slate/10 text-slate';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'connecting':
        return 'Conectando';
      default:
        return 'Aguardando QR';
    }
  };

  const getIconColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-success/10 text-success';
      case 'disconnected':
        return 'bg-error/10 text-error';
      case 'connecting':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-warning/10 text-warning';
    }
  };

  return (
    <Card data-testid={`instance-card-${instance.id}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${getIconColor(instance.status)} rounded-lg flex items-center justify-center`}>
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900" data-testid="instance-name">{instance.name}</h3>
              <p className="text-sm text-slate-500" data-testid="instance-id">ID: {instance.instanceId}</p>
            </div>
          </div>
          <Badge className={getStatusColor(instance.status)} data-testid="instance-status">
            {getStatusLabel(instance.status)}
          </Badge>
        </div>
        
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Número:</span>
            <span className="font-medium" data-testid="instance-phone">
              {instance.phoneNumber || 'Não conectado'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Última conexão:</span>
            <span className="font-medium" data-testid="instance-last-connection">
              {instance.lastConnection 
                ? new Date(instance.lastConnection).toLocaleString('pt-BR') 
                : 'Nunca'
              }
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Mensagens hoje:</span>
            <span className="font-medium" data-testid="instance-daily-messages">{instance.dailyMessages || 0}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            className="flex-1" 
            onClick={() => onShowQR(instance)}
            data-testid="button-show-qr"
          >
            <QrCode size={16} className="mr-2" />
            QR Code
          </Button>
          <Button variant="outline" size="sm" data-testid="button-settings">
            <Settings size={16} />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-error text-error hover:bg-error/5"
            onClick={() => onDelete(instance)}
            data-testid="button-delete-instance"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
