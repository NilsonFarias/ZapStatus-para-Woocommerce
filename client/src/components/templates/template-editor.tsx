import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageTemplate } from "@shared/schema";
import { Edit, Trash2, Save, X } from "lucide-react";
import { useState } from "react";

interface TemplateEditorProps {
  template: MessageTemplate;
  onSave: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
}

export default function TemplateEditor({ template, onSave, onDelete }: TemplateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(template.content);
  const [delayMinutes, setDelayMinutes] = useState(template.delayMinutes || 0);

  const handleSave = () => {
    onSave({
      ...template,
      content,
      delayMinutes,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(template.content);
    setDelayMinutes(template.delayMinutes || 0);
    setIsEditing(false);
  };

  const getSequenceBadgeColor = (sequence: number) => {
    switch (sequence) {
      case 1:
        return 'bg-primary/10 text-primary';
      case 2:
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-slate/10 text-slate';
    }
  };

  const getDelayLabel = (delay: number) => {
    if (delay === 0) return 'Enviada imediatamente';
    if (delay < 60) return `Enviada após ${delay} minutos`;
    const hours = Math.floor(delay / 60);
    const minutes = delay % 60;
    if (minutes === 0) return `Enviada após ${hours} hora${hours > 1 ? 's' : ''}`;
    return `Enviada após ${hours}h${minutes}min`;
  };

  return (
    <Card data-testid={`template-${template.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Badge className={getSequenceBadgeColor(template.sequence)}>
              Mensagem {template.sequence}
            </Badge>
            <span className="text-sm text-slate-500" data-testid="template-delay">
              {getDelayLabel(template.delayMinutes || 0)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave} data-testid="button-save-template">
                  <Save size={16} />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
                  <X size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-template">
                  <Edit size={16} />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-error hover:text-error/80"
                  onClick={() => onDelete(template)}
                  data-testid="button-delete-template"
                >
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="delay">Atraso (minutos)</Label>
              <Input
                id="delay"
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                min={0}
                data-testid="input-template-delay"
              />
            </div>
            <div>
              <Label htmlFor="content">Conteúdo da Mensagem</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Digite a mensagem..."
                data-testid="textarea-template-content"
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-sm text-slate-700 whitespace-pre-wrap" data-testid="template-content">
              {template.content}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
