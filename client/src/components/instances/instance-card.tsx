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
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'disconnected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
      case 'pending':
        return 'Aguardando QR';
      default:
        return 'Aguardando QR';
    }
  };

  const getIconColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
      case 'disconnected':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400';
      case 'pending':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400';
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
              {instance.phoneNumber || (instance.status === 'connected' ? 'Conectado' : 'Não conectado')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Última conexão:</span>
            <span className="font-medium" data-testid="instance-last-connection">
              {instance.lastConnection 
                ? new Date(instance.lastConnection).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : (instance.status === 'connected' ? 'Agora' : 'Nunca')
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
