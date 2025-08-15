import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MetricsCard from "@/components/dashboard/metrics-card";
import ActivityFeed from "@/components/dashboard/activity-feed";
import { Users, Send, DollarSign, CheckCircle, Download, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardMetrics {
  activeClients: number;
  messagesSent: number;
  monthlyRevenue: number;
  deliveryRate: number;
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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
          title="Dashboard"
          description="Visão geral do sistema e métricas"
          showDateFilter={true}
          action={{
            label: "Exportar Relatório",
            onClick: () => console.log("Export report"),
            icon: <Download className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricsCard
              title="Clientes Ativos"
              value={metrics?.activeClients || 0}
              icon={Users}
              trend={{ value: `${metrics?.activeClients || 0} ativo(s)`, isPositive: true, label: "sistema atual" }}
              iconBgColor="bg-primary/10 text-primary"
            />
            <MetricsCard
              title="Mensagens Enviadas"
              value={metrics?.messagesSent || 0}
              icon={Send}
              trend={{ value: "Hoje", isPositive: true, label: "mensagens diárias" }}
              iconBgColor="bg-success/10 text-success"
            />
            <MetricsCard
              title="Receita Mensal"
              value={`R$ ${metrics?.monthlyRevenue || 0}`}
              icon={DollarSign}
              trend={{ value: "R$ 47/cliente", isPositive: true, label: "preço fixo mensal" }}
              iconBgColor="bg-warning/10 text-warning"
            />
            <MetricsCard
              title="Taxa de Entrega"
              value={`${(metrics?.deliveryRate || 100).toFixed(1)}%`}
              icon={CheckCircle}
              trend={{ value: "Evolution API", isPositive: true, label: "plataforma confiável" }}
              iconBgColor="bg-success/10 text-success"
            />
          </div>

          {/* Charts and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      Receita dos Últimos 6 Meses
                    </CardTitle>
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      <option>Receita</option>
                      <option>Novos Clientes</option>
                      <option>Mensagens</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Chart placeholder */}
                  <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center" data-testid="revenue-chart">
                    <div className="text-center">
                      <BarChart3 className="text-4xl text-slate-300 mb-4 mx-auto" size={64} />
                      <p className="text-slate-500">Gráfico de Receita</p>
                      <p className="text-sm text-slate-400">Integração com Chart.js</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <ActivityFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
