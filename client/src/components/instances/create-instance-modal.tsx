import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@shared/schema";

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}

export default function CreateInstanceModal({ open, onOpenChange, clients }: CreateInstanceModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    clientId: "",
  });

  const createInstanceMutation = useMutation({
    mutationFn: (data: { name: string; clientId: string }) =>
      apiRequest("POST", "/api/instances", data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instances'] });
      toast({
        title: "Instância criada",
        description: "A nova instância foi criada com sucesso!",
      });
      onOpenChange(false);
      setFormData({ name: "", clientId: "" });
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
    if (!formData.name || !formData.clientId) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }
    createInstanceMutation.mutate(formData);
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
          <div className="space-y-2">
            <Label htmlFor="client-select">Cliente</Label>
            <Select 
              value={formData.clientId} 
              onValueChange={(value) => setFormData({ ...formData, clientId: value })}
            >
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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