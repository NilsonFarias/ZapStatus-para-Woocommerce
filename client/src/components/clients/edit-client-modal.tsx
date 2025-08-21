import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Client } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, User } from "lucide-react";

const updateClientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  plan: z.enum(["free", "basic", "pro", "enterprise"]),
  status: z.enum(["active", "inactive", "suspended"]),
});

type UpdateClientData = z.infer<typeof updateClientSchema>;

interface EditClientModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditClientModal({ client, open, onOpenChange }: EditClientModalProps) {
  const { toast } = useToast();
  
  const form = useForm<UpdateClientData>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      plan: "basic",
      status: "active",
    },
  });

  // Update form values when client changes
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        email: client.email,
        phone: client.phone || "+55 (11) 99999-9999",
        plan: client.plan as "free" | "basic" | "pro" | "enterprise",
        status: client.status as "active" | "inactive" | "suspended",
      });
    }
  }, [client, form]);

  const updateClientMutation = useMutation({
    mutationFn: (data: UpdateClientData) => 
      apiRequest("PUT", `/api/clients/${client?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: "Cliente atualizado",
        description: "As informações do cliente foram atualizadas com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateClientData) => {
    updateClientMutation.mutate(data);
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'Gratuito';
      case 'basic':
        return 'Básico';
      case 'pro':
        return 'Pro';
      case 'enterprise':
        return 'Enterprise';
      default:
        return plan;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'suspended':
        return 'Suspenso';
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Cliente
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Nome da empresa"
                className="pl-9"
                {...form.register("name")}
                data-testid="input-edit-name"
              />
            </div>
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="email@empresa.com"
                className="pl-9"
                {...form.register("email")}
                data-testid="input-edit-email"
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="+55 (11) 99999-9999"
              {...form.register("phone")}
              data-testid="input-edit-phone"
            />
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select
                value={form.watch("plan")}
                onValueChange={(value) => form.setValue("plan", value as any)}
              >
                <SelectTrigger data-testid="select-edit-plan">
                  <SelectValue placeholder="Selecionar plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Gratuito - R$ 0/mês (30 mensagens)</SelectItem>
                  <SelectItem value="basic">Básico - R$ 29/mês (1.000 mensagens)</SelectItem>
                  <SelectItem value="pro">Pro - R$ 89/mês (10.000 mensagens)</SelectItem>
                  <SelectItem value="enterprise">Enterprise - R$ 199/mês (Ilimitado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value as any)}
              >
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{getStatusLabel("active")}</SelectItem>
                  <SelectItem value="inactive">{getStatusLabel("inactive")}</SelectItem>
                  <SelectItem value="suspended">{getStatusLabel("suspended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateClientMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateClientMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}