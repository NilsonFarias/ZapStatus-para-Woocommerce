import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Client } from "@shared/schema";

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateInstanceModal({ open, onOpenChange }: CreateInstanceModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
  });

  // Get user's client data
  const { data: userClients = [] } = useQuery({
    queryKey: ['/api/user/clients'],
    enabled: !!user && user.role !== 'admin',
  });

  // Check if user already has an instance
  const { data: instances = [] } = useQuery({
    queryKey: ['/api/user/instances'],
    enabled: !!user && user.role !== 'admin',
  });

  const clientId = userClients.length > 0 ? userClients[0].id : null;
  const hasExistingInstance = instances.length > 0;

  const createInstanceMutation = useMutation({
    mutationFn: (data: { name: string; clientId: string }) =>
      apiRequest("POST", "/api/instances", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/instances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instances'] });
      toast({
        title: "Instância criada",
        description: "A nova instância foi criada com sucesso!",
      });
      onOpenChange(false);
      setFormData({ name: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Falha ao criar instância: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o nome da instância.",
        variant: "destructive",
      });
      return;
    }
    
    if (!clientId) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado. Tente fazer login novamente.",
        variant: "destructive",
      });
      return;
    }
    
    if (hasExistingInstance) {
      toast({
        title: "Erro",
        description: "Você já possui uma instância WhatsApp. Cada cliente pode ter apenas uma instância.",
        variant: "destructive",
      });
      return;
    }
    
    createInstanceMutation.mutate({ name: formData.name, clientId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Instância WhatsApp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da Instância</Label>
            <Input
              id="instance-name"
              placeholder="Ex: Loja Fashion Bot"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="input-instance-name"
            />
          </div>
          {hasExistingInstance && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                Você já possui uma instância WhatsApp. Cada cliente pode ter apenas uma instância ativa.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={createInstanceMutation.isPending}
              data-testid="button-create"
            >
              {createInstanceMutation.isPending ? "Criando..." : "Criar Instância"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}