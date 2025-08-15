import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Crown, Zap, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface PlanLimits {
  allowed: boolean;
  limit: number;
  current: number;
  plan: string;
}

export default function PlanUsageCard() {
  const { user } = useAuth();
  
  const { data: planLimits, isLoading } = useQuery<PlanLimits>({
    queryKey: ['/api/plan-limits'],
    enabled: !!user && user.role !== 'admin',
  });

  // Don't show for admins
  if (!user || user.role === 'admin') {
    return null;
  }

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'basic': return <Shield className="w-5 h-5 text-blue-500" />;
      case 'pro': return <Crown className="w-5 h-5 text-purple-500" />;
      case 'enterprise': return <Zap className="w-5 h-5 text-green-500" />;
      default: return null;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'border-yellow-200 bg-yellow-50';
      case 'basic': return 'border-blue-200 bg-blue-50';
      case 'pro': return 'border-purple-200 bg-purple-50';
      case 'enterprise': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'free': return 'Gratuito';
      case 'basic': return 'Básico';
      case 'pro': return 'Pro';
      case 'enterprise': return 'Enterprise';
      default: return 'Gratuito';
    }
  };

  return (
    <Card className={`mb-6 border-2 ${planLimits ? getPlanColor(planLimits.plan) : 'border-gray-200 bg-gray-50'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {planLimits && getPlanIcon(planLimits.plan)}
          {isLoading ? 'Carregando plano...' : planLimits ? `Plano ${getPlanDisplayName(planLimits.plan)}` : 'Erro ao carregar plano'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-gray-500">Carregando informações do plano...</div>
        ) : planLimits ? (
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Mensagens este mês</span>
              <span className="font-medium">
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
              <div className="text-red-600 text-sm font-medium bg-red-100 p-3 rounded-lg">
                ⚠️ Limite de mensagens atingido! Atualize seu plano para continuar enviando.
              </div>
            )}
            
            {planLimits.plan === 'free' && planLimits.allowed && (
              <div className="text-yellow-700 text-sm bg-yellow-100 p-3 rounded-lg">
                💡 Plano gratuito - {30 - planLimits.current} mensagens restantes este mês
              </div>
            )}
            
            {planLimits.plan === 'basic' && planLimits.allowed && (
              <div className="text-blue-700 text-sm bg-blue-100 p-3 rounded-lg">
                ⭐ Plano Básico - {planLimits.limit - planLimits.current} mensagens restantes este mês
              </div>
            )}
            
            {planLimits.current / planLimits.limit > 0.8 && planLimits.limit !== -1 && planLimits.allowed && (
              <div className="text-orange-700 text-sm bg-orange-100 p-3 rounded-lg">
                ⚡ Você usou {Math.round((planLimits.current / planLimits.limit) * 100)}% do seu plano. Considere fazer upgrade!
              </div>
            )}
          </div>
        ) : (
          <div className="text-red-500">Erro ao carregar informações do plano</div>
        )}
      </CardContent>
    </Card>
  );
}