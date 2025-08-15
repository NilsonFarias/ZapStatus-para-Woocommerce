import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, TrendingDown, CreditCard, Download, RefreshCw } from "lucide-react";

interface DashboardMetrics {
  activeClients: number;
  messagesSent: number;
  monthlyRevenue: number;
  deliveryRate: number;
}

interface Client {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export default function Billing() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    queryFn: () => apiRequest("GET", '/api/dashboard/metrics').then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: () => apiRequest("GET", '/api/clients').then(res => res.json()),
    refetchInterval: 30000,
  });

  if (metricsLoading || clientsLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Faturamento" description="Carregando dados de faturamento..." />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const revenuePerClient = 47; // R$ 47/mês por cliente
  const activeClients = metrics?.activeClients || 0;
  const monthlyRevenue = activeClients * revenuePerClient;
  const messagesSent = metrics?.messagesSent || 0;
  const deliveryRate = metrics?.deliveryRate || 0;

  const billingMetrics = [
    {
      title: "Receita Mensal",
      value: `R$ ${monthlyRevenue.toLocaleString('pt-BR')}`,
      icon: DollarSign,
      trend: `${activeClients} clientes ativos`,
      trendLabel: "R$ 47/mês por cliente",
      bgColor: "bg-green-100 text-green-800"
    },
    {
      title: "Clientes Ativos",
      value: activeClients.toString(),
      icon: Users,
      trend: `${clients.length} total`,
      trendLabel: "clientes cadastrados",
      bgColor: "bg-blue-100 text-blue-800"
    },
    {
      title: "Taxa de Entrega",
      value: `${deliveryRate.toFixed(1)}%`,
      icon: TrendingDown,
      trend: `${messagesSent} mensagens`,
      trendLabel: "enviadas hoje",
      bgColor: deliveryRate >= 95 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
    },
    {
      title: "Ticket Médio",
      value: `R$ ${revenuePerClient}`,
      icon: CreditCard,
      trend: "Plano padrão",
      trendLabel: "valor fixo mensal",
      bgColor: "bg-purple-100 text-purple-800"
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Faturamento"
          description="Gerencie receita e assinaturas de clientes"
          action={{
            label: "Atualizar Dados",
            onClick: () => window.location.reload(),
            icon: <RefreshCw className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          {/* Revenue Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {billingMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.title} data-testid={`billing-metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">{metric.title}</p>
                        <p className="text-2xl font-bold text-slate-900" data-testid="metric-value">
                          {metric.value}
                        </p>
                      </div>
                      <div className={`w-10 h-10 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon size={20} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center">
                      <span className="text-success text-sm font-medium">{metric.trend}</span>
                      <span className="text-slate-500 text-sm ml-2">{metric.trendLabel}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Clients Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Clients */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Clientes Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clients.filter(c => c.status === 'active').length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum cliente ativo</p>
                    </div>
                  ) : (
                    clients.filter(c => c.status === 'active').map((client) => (
                      <div 
                        key={client.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`active-client-${client.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-slate-900">{client.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900" data-testid="client-revenue">
                            R$ 47/mês
                          </p>
                          <p className="text-sm text-slate-500" data-testid="client-status">
                            Ativo
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* System Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Estatísticas do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Taxa de Entrega</span>
                    <span className="font-semibold">{deliveryRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mensagens Enviadas Hoje</span>
                    <span className="font-semibold">{messagesSent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Clientes Totais</span>
                    <span className="font-semibold">{clients.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita Projetada</span>
                    <span className="font-semibold text-green-600">R$ {monthlyRevenue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
