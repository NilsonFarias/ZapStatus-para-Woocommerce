import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import CreateClientModal from "@/components/clients/create-client-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Client } from "@shared/schema";
import { Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Clients() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const deleteClientMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest("DELETE", `/api/clients/${clientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: "Cliente removido",
        description: "Cliente foi removido com sucesso.",
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

  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === "all" || client.plan === planFilter;
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'basic':
        return 'bg-warning/10 text-warning';
      case 'pro':
        return 'bg-primary/10 text-primary';
      case 'enterprise':
        return 'bg-success/10 text-success';
      default:
        return 'bg-slate/10 text-slate';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success';
      case 'inactive':
        return 'bg-slate/10 text-slate';
      case 'suspended':
        return 'bg-error/10 text-error';
      default:
        return 'bg-slate/10 text-slate';
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
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
          title="Gestão de Clientes"
          description="Gerencie todos os seus clientes e suas configurações"
          action={{
            label: "Adicionar Cliente",
            onClick: () => setCreateModalOpen(true),
            icon: <Plus className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="Buscar clientes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-clients"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-48" data-testid="select-plan-filter">
                    <SelectValue placeholder="Todos os planos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="basic">Plano Básico</SelectItem>
                    <SelectItem value="pro">Plano Pro</SelectItem>
                    <SelectItem value="enterprise">Plano Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48" data-testid="select-status-filter">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Clients Table */}
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagens/Mês</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client: Client) => (
                    <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-primary text-sm font-medium">
                              {client.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900" data-testid="client-name">{client.name}</p>
                            <p className="text-sm text-slate-500" data-testid="client-email">{client.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPlanBadgeColor(client.plan)} data-testid="client-plan">
                          {getPlanLabel(client.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(client.status)} data-testid="client-status">
                          {getStatusLabel(client.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600" data-testid="client-messages">
                        {client.monthlyMessages?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-slate-600" data-testid="client-last-access">
                        {client.lastAccess 
                          ? new Date(client.lastAccess).toLocaleDateString('pt-BR') 
                          : 'Nunca'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid="button-edit-client">
                            <Edit size={16} className="text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid="button-view-client">
                            <Eye size={16} className="text-slate-400" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteClientMutation.mutate(client.id)}
                            disabled={deleteClientMutation.isPending}
                            data-testid="button-delete-client"
                          >
                            <Trash2 size={16} className="text-error" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-600" data-testid="pagination-info">
                Mostrando 1-{filteredClients.length} de {clients.length} clientes
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled data-testid="button-previous-page">
                  Anterior
                </Button>
                <Button size="sm" data-testid="button-page-1">1</Button>
                <Button variant="outline" size="sm" disabled data-testid="button-next-page">
                  Próximo
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <CreateClientModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      </main>
    </div>
  );
}
