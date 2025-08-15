import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

import TemplateEditor from "@/components/templates/template-editor";
import TemplateModal from "@/components/templates/template-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageTemplate, Client } from "@shared/schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pedido Recebido' },
  { value: 'processing', label: 'Processando' },
  { value: 'on-hold', label: 'Em Espera' },
  { value: 'completed', label: 'Concluído' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'failed', label: 'Falhado' },
];

const AVAILABLE_VARIABLES = [
  { code: '{{nome_cliente}}', description: 'Nome do cliente' },
  { code: '{{numero_pedido}}', description: 'Número do pedido' },
  { code: '{{status_pedido}}', description: 'Status do pedido' },
  { code: '{{valor_pedido}}', description: 'Valor total' },
  { code: '{{data_pedido}}', description: 'Data do pedido' },
];

export default function Templates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  // Get user's client data
  const { data: userClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/user/clients'],
    enabled: !!user && user.role !== 'admin',
  });
  
  const clientId = userClients.length > 0 ? userClients[0].id : null;

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/templates', clientId, selectedStatus],
    queryFn: () => apiRequest("GET", `/api/templates?clientId=${clientId}&orderStatus=${selectedStatus}`).then(res => res.json()),
    enabled: !!clientId,
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MessageTemplate> }) =>
      apiRequest("PUT", `/api/templates/${id}`, updates).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', clientId, selectedStatus] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template atualizado",
        description: "O template foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => apiRequest("DELETE", `/api/templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', clientId, selectedStatus] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template removido",
        description: "O template foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Old function removed - using new handleSaveTemplate below

  const createTemplateMutation = useMutation({
    mutationFn: (newTemplate: Partial<MessageTemplate>) => 
      apiRequest("POST", `/api/templates`, newTemplate).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', clientId, selectedStatus] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template criado",
        description: "O template foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (templateData: Partial<MessageTemplate>) => {
    try {
      if (templateData.id) {
        // Update existing template
        await updateTemplateMutation.mutateAsync({ 
          id: templateData.id, 
          updates: templateData
        });
      } else {
        // Create new template
        await createTemplateMutation.mutateAsync(templateData as any);
      }
      setIsModalOpen(false);
      setEditingTemplate(null);
    } catch (error: any) {
      console.error('Error saving template:', error);
    }
  };

  const handleSaveTemplateOld = async (template: MessageTemplate) => {
    await updateTemplateMutation.mutateAsync({ 
      id: template.id, 
      updates: {
        content: template.content,
        delayMinutes: template.delayMinutes,
      }
    });
  };

  const handleDeleteTemplate = async (template: MessageTemplate) => {
    if (confirm('Tem certeza que deseja remover este template?')) {
      try {
        await deleteTemplateMutation.mutateAsync(template.id);
        toast({
          title: "Template removido",
          description: "Template removido com sucesso!",
        });
      } catch (error: any) {
        if (error.message.includes('mensagem(s) na fila')) {
          toast({
            title: "Não foi possível remover o template",
            description: error.message + " Acesse 'Fila de Mensagens' para gerenciar mensagens pendentes.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: "Erro ao remover template: " + error.message,
            variant: "destructive",
          });
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Criar Mensagens"
          description="Configure mensagens automáticas para cada status do pedido"
          action={{
            label: createTemplateMutation.isPending ? "Criando..." : "Novo Template",
            onClick: () => handleCreateTemplate(),
            disabled: createTemplateMutation.isPending,
            icon: createTemplateMutation.isPending ? 
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" /> :
              <Plus className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          {/* Status Tabs */}
          <Card className="mb-6">
            <CardHeader className="border-b border-slate-200 pb-4">
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((status) => (
                  <Button
                    key={status.value}
                    variant={selectedStatus === status.value ? "default" : "outline"}
                    onClick={() => setSelectedStatus(status.value)}
                    data-testid={`status-tab-${status.value}`}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </CardHeader>

            {/* Message Templates for Selected Status */}
            <CardContent className="p-6">
              <div className="space-y-4">
                {templates
                  .filter((template: MessageTemplate) => template.orderStatus === selectedStatus)
                  .map((template: MessageTemplate) => (
                    <TemplateEditor
                      key={template.id}
                      template={template}
                      onSave={handleSaveTemplateOld}
                      onDelete={handleDeleteTemplate}
                      onEdit={() => handleEditTemplate(template)}
                    />
                  ))
                }
                
                {/* Add New Message */}
                <Button
                  variant="outline"
                  className="w-full border-2 border-dashed border-slate-300 h-16 text-slate-500 hover:border-primary hover:text-primary"
                  onClick={handleCreateTemplate}
                  disabled={createTemplateMutation.isPending}
                  data-testid="button-add-template"
                >
                  {createTemplateMutation.isPending ? (
                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
                  ) : (
                    <Plus className="mr-2" size={20} />
                  )}
                  {createTemplateMutation.isPending ? 'Criando...' : 'Adicionar Nova Mensagem'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Available Variables */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-slate-900">Variáveis Disponíveis</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <Card key={variable.code} className="border border-slate-200 p-3 text-center">
                    <code className="text-sm text-primary font-mono" data-testid="variable-code">
                      {variable.code}
                    </code>
                    <p className="text-xs text-slate-500 mt-1" data-testid="variable-description">
                      {variable.description}
                    </p>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Modal */}
        <TemplateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTemplate}
          template={editingTemplate}
          orderStatus={selectedStatus}
          clientId={clientId || ''}
          isSaving={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
      </main>
    </div>
  );
}
