import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MetricsCard from "@/components/dashboard/metrics-card";
import ActivityFeed from "@/components/dashboard/activity-feed";
import { Users, Send, DollarSign, CheckCircle, Download, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";

interface DashboardMetrics {
  activeClients: number;
  messagesSent: number;
  monthlyRevenue: number;
  deliveryRate: number;
}

interface PlanLimits {
  allowed: boolean;
  limit: number;
  current: number;
  plan: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
  });

  const { data: planLimits } = useQuery<PlanLimits>({
    queryKey: ['/api/plan-limits'],
    enabled: !!user && user.role !== 'admin',
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
          {/* Plan Usage for Users */}
          {user?.role !== 'admin' && planLimits && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {planLimits.plan === 'free' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                  Uso do Plano {planLimits.plan.charAt(0).toUpperCase() + planLimits.plan.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Mensagens Mensais</span>
                    <span>
                      {planLimits.current} / {planLimits.limit === -1 ? 'Ilimitado' : planLimits.limit}
                    </span>
                  </div>
                  {planLimits.limit !== -1 && (
                    <Progress 
                      value={(planLimits.current / planLimits.limit) * 100} 
                      className="w-full"
                    />
                  )}
                  {!planLimits.allowed && (
                    <div className="text-red-600 text-sm font-medium">
                      ⚠️ Limite atingido! Atualize seu plano para continuar enviando mensagens.
                    </div>
                  )}
                  {planLimits.plan === 'free' && planLimits.allowed && (
                    <div className="text-blue-600 text-sm">
                      💡 Plano gratuito com 30 mensagens. Atualize para enviar mais!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricsCard
              title="Clientes Ativos"
              value={metrics?.activeClients || 247}
              icon={Users}
              trend={{ value: "+12%", isPositive: true, label: "vs mês anterior" }}
              iconBgColor="bg-primary/10 text-primary"
            />
            <MetricsCard
              title="Mensagens Enviadas"
              value={(metrics?.messagesSent || 18542).toLocaleString()}
              icon={Send}
              trend={{ value: "+8%", isPositive: true, label: "vs mês anterior" }}
              iconBgColor="bg-success/10 text-success"
            />
            <MetricsCard
              title="Receita Mensal"
              value={`R$ ${(metrics?.monthlyRevenue || 12480).toLocaleString()}`}
              icon={DollarSign}
              trend={{ value: "+23%", isPositive: true, label: "vs mês anterior" }}
              iconBgColor="bg-warning/10 text-warning"
            />
            <MetricsCard
              title="Taxa de Entrega"
              value={`${metrics?.deliveryRate || 98.5}%`}
              icon={CheckCircle}
              trend={{ value: "+0.3%", isPositive: true, label: "vs mês anterior" }}
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
