import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Eye, EyeOff, Shield, User, Plus, Edit, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Client } from "@shared/schema";
import CreateClientModal from "@/components/clients/create-client-modal";
import EditClientModal from "@/components/clients/edit-client-modal";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: 'admin' | 'user';
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export default function Management() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clients");
  
  // Client management state
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // User management state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    company: '',
    phone: '',
    role: 'admin' as 'admin' | 'user',
  });

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Fetch admin users
  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Client mutations
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

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      return apiRequest("POST", "/api/admin/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        name: '',
        company: '',
        phone: '',
        role: 'admin',
      });
      toast({
        title: "Usuário criado",
        description: "Novo usuário admin foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuário removido",
        description: "Usuário foi removido com sucesso.",
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

  // Client filters
  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === "all" || client.plan === planFilter;
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Helper functions for clients
  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-warning/10 text-warning';
      case 'pro': return 'bg-primary/10 text-primary';
      case 'enterprise': return 'bg-success/10 text-success';
      default: return 'bg-slate/10 text-slate';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success';
      case 'inactive': return 'bg-slate/10 text-slate';
      case 'suspended': return 'bg-error/10 text-error';
      default: return 'bg-slate/10 text-slate';
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'basic': return 'Básico (1k msgs)';
      case 'pro': return 'Pro (10k msgs)';
      case 'enterprise': return 'Enterprise (∞)';
      default: return plan;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  const handleCreateUser = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.name) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(formData);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Header title="Gerenciamento" description="Gerencie clientes e usuários administrativos do sistema" />
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900" data-testid="page-title">
                Gerenciamento
              </h1>
              <p className="text-slate-600">
                Gerencie clientes e usuários administrativos do sistema
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="clients" className="flex items-center gap-2" data-testid="tab-clients">
                  <Users size={16} />
                  Clientes
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
                  <Shield size={16} />
                  Usuários Admin
                </TabsTrigger>
              </TabsList>

              {/* Clients Tab */}
              <TabsContent value="clients" className="space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900">
                          Clientes ({filteredClients.length})
                        </CardTitle>
                        <CardDescription>
                          Gerencie todos os clientes do sistema
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center space-x-2"
                        data-testid="button-create-client"
                      >
                        <Plus size={16} />
                        <span>Criar Cliente</span>
                      </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <div className="flex-1">
                        <Input
                          placeholder="Pesquisar por nome ou email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          data-testid="input-search-clients"
                        />
                      </div>
                      <Select value={planFilter} onValueChange={setPlanFilter}>
                        <SelectTrigger className="w-full sm:w-48" data-testid="select-plan-filter">
                          <SelectValue placeholder="Filtrar por plano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os planos</SelectItem>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                          <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                          <SelectItem value="suspended">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Assinatura</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Mensagens/Mês</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientsLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                Carregando clientes...
                              </TableCell>
                            </TableRow>
                          ) : filteredClients.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                Nenhum cliente encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredClients.map((client: any) => (
                              <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <p className="font-medium text-slate-900" data-testid="client-name">
                                        {client.name}
                                      </p>
                                    </div>
                                    <p className="text-sm text-slate-500" data-testid="client-email">
                                      {client.email}
                                    </p>
                                    <p className="text-xs text-slate-400" data-testid="client-company">
                                      {client.company}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <div 
                                        className={`w-2 h-2 rounded-full ${
                                          (client as any).subscriptionStatus === 'active' ? 'bg-green-500' : 
                                          (client as any).subscriptionStatus === 'cancel_at_period_end' ? 'bg-yellow-500' : 
                                          'bg-red-500'
                                        }`}
                                      />
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs"
                                        data-testid="subscription-status"
                                      >
                                        {(client as any).subscriptionStatus || 'inactive'}
                                      </Badge>
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
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => {
                                        setSelectedClient(client);
                                        setEditModalOpen(true);
                                      }}
                                      data-testid="button-edit-client"
                                    >
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
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900">
                          Usuários Administrativos ({users.length})
                        </CardTitle>
                        <CardDescription>
                          Gerencie usuários com acesso administrativo
                        </CardDescription>
                      </div>
                      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="flex items-center space-x-2" data-testid="button-create-user">
                            <UserPlus size={16} />
                            <span>Criar Usuário</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Criar Novo Usuário Admin</DialogTitle>
                            <DialogDescription>
                              Preencha os dados para criar um novo usuário administrativo
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="username">Usuário *</Label>
                                <Input
                                  id="username"
                                  value={formData.username}
                                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                  placeholder="usuario_admin"
                                  data-testid="input-username"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo *</Label>
                                <Input
                                  id="name"
                                  value={formData.name}
                                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="João Silva"
                                  data-testid="input-name"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="email">Email *</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="admin@empresa.com"
                                data-testid="input-email"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="password">Senha *</Label>
                              <div className="relative">
                                <Input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  value={formData.password}
                                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                  placeholder="••••••••"
                                  data-testid="input-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowPassword(prev => !prev)}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-slate-500" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="company">Empresa</Label>
                                <Input
                                  id="company"
                                  value={formData.company}
                                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                                  placeholder="Empresa LTDA"
                                  data-testid="input-company"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="phone">Telefone</Label>
                                <Input
                                  id="phone"
                                  value={formData.phone}
                                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="(11) 99999-9999"
                                  data-testid="input-phone"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="role">Nível de Acesso</Label>
                              <Select 
                                value={formData.role} 
                                onValueChange={(value: 'admin' | 'user') => setFormData(prev => ({ ...prev, role: value }))}
                              >
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="user">Usuário</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex justify-end space-x-2 pt-4">
                              <Button 
                                variant="outline" 
                                onClick={() => setIsCreateDialogOpen(false)}
                                data-testid="button-cancel"
                              >
                                Cancelar
                              </Button>
                              <Button 
                                onClick={handleCreateUser}
                                disabled={createUserMutation.isPending}
                                data-testid="button-save-user"
                              >
                                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Nível</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Criado em</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                Carregando usuários...
                              </TableCell>
                            </TableRow>
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                Nenhum usuário encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            users.map((user) => (
                              <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <p className="font-medium text-slate-900" data-testid="user-name">
                                        {user.name}
                                      </p>
                                    </div>
                                    <p className="text-sm text-slate-500" data-testid="user-email">
                                      {user.email}
                                    </p>
                                    <p className="text-xs text-slate-400" data-testid="user-username">
                                      @{user.username}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={user.role === 'admin' ? 'destructive' : 'secondary'}
                                    className="flex items-center gap-1 w-fit"
                                    data-testid="user-role"
                                  >
                                    {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                                    {user.role === 'admin' ? 'Admin' : 'Usuário'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-600" data-testid="user-company">
                                  {user.company || '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" data-testid="user-plan">
                                    {user.plan}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-600" data-testid="user-created">
                                  {new Date(user.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => deleteUserMutation.mutate(user.id)}
                                    disabled={deleteUserMutation.isPending}
                                    data-testid="button-delete-user"
                                  >
                                    <Trash2 size={16} className="text-error" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <CreateClientModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <EditClientModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        client={selectedClient}
      />
    </div>
  );
}