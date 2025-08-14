import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageTemplate } from "@shared/schema";
import { useState } from "react";
import { Save, X } from "lucide-react";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Partial<MessageTemplate>) => void;
  template?: MessageTemplate | null;
  orderStatus: string;
  clientId: string;
  isSaving?: boolean;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  'pending': 'Pedido Recebido',
  'processing': 'Processando',
  'on-hold': 'Em Espera',
  'completed': 'Concluído',
  'shipped': 'Enviado',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado',
  'refunded': 'Reembolsado',
  'failed': 'Falhado',
};

export default function TemplateModal({ 
  isOpen, 
  onClose, 
  onSave, 
  template, 
  orderStatus,
  clientId,
  isSaving = false
}: TemplateModalProps) {
  const [content, setContent] = useState(template?.content || '');
  const [delayMinutes, setDelayMinutes] = useState(template?.delayMinutes || 0);
  const [delayType, setDelayType] = useState(
    template?.delayMinutes === 0 ? 'immediate' : 
    template?.delayMinutes && template.delayMinutes < 60 ? 'minutes' : 'hours'
  );
  const [delayValue, setDelayValue] = useState(
    template?.delayMinutes === 0 ? 0 :
    template?.delayMinutes && template.delayMinutes < 60 ? template.delayMinutes :
    template?.delayMinutes ? Math.floor(template.delayMinutes / 60) : 0
  );

  const handleSave = () => {
    let finalDelayMinutes = 0;
    
    if (delayType === 'minutes') {
      finalDelayMinutes = delayValue;
    } else if (delayType === 'hours') {
      finalDelayMinutes = delayValue * 60;
    }

    const templateData: Partial<MessageTemplate> = {
      ...(template?.id && { id: template.id }),
      clientId,
      orderStatus,
      content,
      delayMinutes: finalDelayMinutes,
      sequence: template?.sequence || 1,
      isActive: true,
    };

    onSave(templateData);
  };

  const insertVariable = (variable: string) => {
    setContent(prev => prev + variable);
  };

  const variables = [
    { code: '{{nome_cliente}}', description: 'Nome do cliente' },
    { code: '{{numero_pedido}}', description: 'Número do pedido' },
    { code: '{{status_pedido}}', description: 'Status do pedido' },
    { code: '{{valor_pedido}}', description: 'Valor total' },
    { code: '{{data_pedido}}', description: 'Data do pedido' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar Template' : 'Novo Template'} - {ORDER_STATUS_LABELS[orderStatus]}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Mensagem</Label>
            <Textarea
              id="content"
              placeholder="Digite sua mensagem aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="resize-none"
              data-testid="textarea-template-content"
            />
            <p className="text-sm text-slate-500">
              Use as variáveis abaixo para personalizar sua mensagem
            </p>
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label>Variáveis Disponíveis</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {variables.map((variable) => (
                <Button
                  key={variable.code}
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(variable.code)}
                  className="justify-start text-left h-auto py-2"
                  data-testid={`button-variable-${variable.code.replace(/[{}]/g, '')}`}
                >
                  <div>
                    <div className="font-mono text-xs text-primary">{variable.code}</div>
                    <div className="text-xs text-slate-500">{variable.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Delay Configuration */}
          <div className="space-y-4">
            <Label>Configuração de Envio</Label>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="immediate"
                  name="delay"
                  checked={delayType === 'immediate'}
                  onChange={() => setDelayType('immediate')}
                  data-testid="radio-immediate"
                />
                <Label htmlFor="immediate">Enviar imediatamente</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="minutes"
                  name="delay"
                  checked={delayType === 'minutes'}
                  onChange={() => setDelayType('minutes')}
                  data-testid="radio-minutes"
                />
                <Label htmlFor="minutes">Enviar após</Label>
                <Input
                  type="number"
                  min="1"
                  max="59"
                  value={delayType === 'minutes' ? delayValue : ''}
                  onChange={(e) => setDelayValue(parseInt(e.target.value) || 0)}
                  className="w-20"
                  disabled={delayType !== 'minutes'}
                  data-testid="input-delay-minutes"
                />
                <span className="text-sm text-slate-600">minutos</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="hours"
                  name="delay"
                  checked={delayType === 'hours'}
                  onChange={() => setDelayType('hours')}
                  data-testid="radio-hours"
                />
                <Label htmlFor="hours">Enviar após</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={delayType === 'hours' ? delayValue : ''}
                  onChange={(e) => setDelayValue(parseInt(e.target.value) || 0)}
                  className="w-20"
                  disabled={delayType !== 'hours'}
                  data-testid="input-delay-hours"
                />
                <span className="text-sm text-slate-600">horas</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              data-testid="button-cancel-template"
            >
              <X className="mr-2" size={16} />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              data-testid="button-save-template"
            >
              {isSaving ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              ) : (
                <Save className="mr-2" size={16} />
              )}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}