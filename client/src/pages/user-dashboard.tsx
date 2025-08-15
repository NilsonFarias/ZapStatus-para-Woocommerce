import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import PlanUsageCard from "@/components/layout/plan-usage-card";
import MetricsCard from "@/components/dashboard/metrics-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  Smartphone, 
  Mail, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface UserMetrics {
  totalMessages: number;
  messagesSentToday: number;
  activeInstances: number;
  totalInstances: number;
  templatesConfigured: number;
  deliveryRate: number;
  recentActivity: {
    id: string;
    type: 'message_sent' | 'instance_connected' | 'template_created';
    description: string;
    timestamp: string;
    status: 'success' | 'error' | 'pending';
  }[];
  monthlyUsage: {
    date: string;
    messages: number;
  }[];
}

interface PlanLimits {
  allowed: boolean;
  limit: number;
  current: number;
  plan: string;
}

export default function UserDashboard() {
  const { user } = useAuth();
  
  const { data: metrics, isLoading: metricsLoading } = useQuery<UserMetrics>({
    queryKey: ['/api/user/metrics'],
    enabled: !!user && user.role !== 'admin',
  });

  const { data: planLimits } = useQuery<PlanLimits>({
    queryKey: ['/api/plan-limits'],
    enabled: !!user && user.role !== 'admin',
  });

  if (metricsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'message_sent': return <MessageCircle className="w-4 h-4" />;
      case 'instance_connected': return <Smartphone className="w-4 h-4" />;
      case 'template_created': return <Mail className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Meu Dashboard"
          description="Visão geral das suas atividades e métricas"
        />
        
        <div className="p-6">
          <PlanUsageCard />
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricsCard
              title="Mensagens este Mês"
              value={planLimits?.current || 0}
              icon={MessageCircle}
              trend={{ 
                value: `${metrics?.messagesSentToday || 0} hoje`, 
                isPositive: true, 
                label: "enviadas hoje" 
              }}
              iconBgColor="bg-blue-100 text-blue-600"
            />
            <MetricsCard
              title="Instâncias Ativas"
              value={`${metrics?.activeInstances || 0}/${metrics?.totalInstances || 0}`}
              icon={Smartphone}
              trend={{ 
                value: metrics?.activeInstances === metrics?.totalInstances ? "100%" : "Conectar", 
                isPositive: metrics?.activeInstances === metrics?.totalInstances, 
                label: "conectividade" 
              }}
              iconBgColor="bg-green-100 text-green-600"
            />
            <MetricsCard
              title="Templates"
              value={metrics?.templatesConfigured || 0}
              icon={Mail}
              trend={{ 
                value: "Configurados", 
                isPositive: true, 
                label: "prontos para uso" 
              }}
              iconBgColor="bg-purple-100 text-purple-600"
            />
            <MetricsCard
              title="Taxa de Entrega"
              value={`${metrics?.deliveryRate || 98.5}%`}
              icon={CheckCircle}
              trend={{ 
                value: "+0.2%", 
                isPositive: true, 
                label: "vs semana passada" 
              }}
              iconBgColor="bg-orange-100 text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Usage Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Uso Mensal de Mensagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {planLimits && (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Progresso do Mês</span>
                      <span>{planLimits.current} / {planLimits.limit === -1 ? '∞' : planLimits.limit}</span>
                    </div>
                    {planLimits.limit !== -1 && (
                      <Progress 
                        value={(planLimits.current / planLimits.limit) * 100} 
                        className="w-full h-3"
                      />
                    )}
                    <div className="text-xs text-gray-500">
                      {planLimits.limit !== -1 && 
                        `${planLimits.limit - planLimits.current} mensagens restantes`
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Atividade Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.recentActivity?.length ? (
                    metrics.recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={`p-1 rounded-full ${getStatusColor(activity.status)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/instances">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Gerenciar Instâncias</div>
                        <div className="text-xs text-gray-500">Conectar WhatsApp</div>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/templates">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Configurar Templates</div>
                        <div className="text-xs text-gray-500">Mensagens automáticas</div>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/message-queue">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Ver Fila</div>
                        <div className="text-xs text-gray-500">Mensagens pendentes</div>
                      </div>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}