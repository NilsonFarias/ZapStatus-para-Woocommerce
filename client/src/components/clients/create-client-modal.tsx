import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateClientModal({ open, onOpenChange }: CreateClientModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    plan: "basic",
  });

  const createClientMutation = useMutation({
    mutationFn: (data: { name: string; email: string; plan: string }) =>
      apiRequest("POST", "/api/clients", data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: "Cliente criado",
        description: "O novo cliente foi adicionado com sucesso!",
      });
      onOpenChange(false);
      setFormData({ name: "", email: "", plan: "basic" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Falha ao criar cliente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    createClientMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nome do Cliente *</Label>
            <Input
              id="client-name"
              placeholder="Ex: Loja Fashion Store"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="input-client-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email *</Label>
            <Input
              id="client-email"
              type="email"
              placeholder="contato@lojafashion.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              data-testid="input-client-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-plan">Plano</Label>
            <Select 
              value={formData.plan} 
              onValueChange={(value) => setFormData({ ...formData, plan: value })}
            >
              <SelectTrigger data-testid="select-plan">
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Básico - R$ 29/mês</SelectItem>
                <SelectItem value="pro">Pro - R$ 79/mês</SelectItem>
                <SelectItem value="enterprise">Enterprise - R$ 199/mês</SelectItem>
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
              disabled={createClientMutation.isPending}
              data-testid="button-create-client"
            >
              {createClientMutation.isPending ? "Criando..." : "Criar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}