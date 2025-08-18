import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, TrendingDown, CreditCard, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface BillingMetrics {
  monthlyRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  averageTicket: number;
  planDistribution: Array<{
    plan: string;
    price: string;
    clients: number;
    percentage: number;
    color: string;
  }>;
  upcomingRenewals: Array<{
    name: string;
    plan: string;
    amount: string;
    dueDate: string;
    status: string;
  }>;
}

export default function Billing() {
  const { data: billingData, isLoading } = useQuery<BillingMetrics>({
    queryKey: ['/api/billing/metrics'],
  });

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Header
            title="Faturamento"
            description="Gerencie planos, assinaturas e receita"
          />
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </main>
      </div>
    );
  }

  const billingMetrics = billingData ? [
    {
      title: "Receita Mensal",
      value: `R$ ${billingData.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      trend: billingData.monthlyRevenue > 0 ? "+100%" : "0%",
      trendLabel: "receita atual",
      bgColor: "bg-success/10 text-success"
    },
    {
      title: "Assinaturas Ativas",
      value: billingData.activeSubscriptions.toString(),
      icon: Users,
      trend: `+${billingData.activeSubscriptions}`,
      trendLabel: "assinaturas",
      bgColor: "bg-primary/10 text-primary"
    },
    {
      title: "Taxa de Churn",
      value: `${billingData.churnRate}%`,
      icon: TrendingDown,
      trend: billingData.churnRate < 5 ? "Baixa" : "Alta",
      trendLabel: "taxa atual",
      bgColor: billingData.churnRate < 5 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
    },
    {
      title: "Ticket Médio",
      value: `R$ ${billingData.averageTicket}`,
      icon: CreditCard,
      trend: `R$ ${billingData.averageTicket}`,
      trendLabel: "por cliente",
      bgColor: "bg-success/10 text-success"
    },
  ] : [];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Faturamento"
          description="Gerencie planos, assinaturas e receita"
          action={{
            label: "Exportar Relatório",
            onClick: () => console.log("Export billing report"),
            icon: <Download className="mr-2" size={16} />
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

          {/* Plans Overview and Upcoming Renewals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plans Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Distribuição por Planos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(billingData?.planDistribution || []).map((plan) => (
                    <div 
                      key={plan.plan}
                      className="flex items-center justify-between"
                      data-testid={`plan-distribution-${plan.plan.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 ${plan.color} rounded-full`}></div>
                        <span className="font-medium text-slate-900">{plan.plan}</span>
                        <span className="text-sm text-slate-500">{plan.price}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900" data-testid="plan-clients">
                          {plan.clients} clientes
                        </p>
                        <p className="text-sm text-slate-500" data-testid="plan-percentage">
                          {plan.percentage}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Renewals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Próximos Vencimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(billingData?.upcomingRenewals || []).map((renewal, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                      data-testid={`renewal-${index}`}
                    >
                      <div>
                        <p className="font-medium text-slate-900" data-testid="renewal-name">
                          {renewal.name}
                        </p>
                        <p className="text-sm text-slate-500" data-testid="renewal-plan">
                          Plano {renewal.plan} - {renewal.amount}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900" data-testid="renewal-due-date">
                          {renewal.dueDate}
                        </p>
                        <Badge
                          className={
                            renewal.status === "due_today"
                              ? "bg-warning/10 text-warning"
                              : "bg-slate/10 text-slate"
                          }
                          data-testid="renewal-status"
                        >
                          {renewal.status === "due_today" ? "Vence hoje" : "Em dia"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-4 text-primary hover:text-primary/80"
                  data-testid="button-view-all-renewals"
                >
                  Ver todos os vencimentos
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
