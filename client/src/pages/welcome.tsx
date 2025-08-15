import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, MessageSquare, Webhook, Settings, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Conectar WhatsApp",
    description: "Configure sua instância WhatsApp para começar a enviar mensagens",
    icon: MessageSquare,
    action: "Conectar Agora",
    path: "/instances",
  },
  {
    id: 2,
    title: "Criar Templates",
    description: "Defina mensagens automáticas para diferentes status de pedidos",
    icon: Settings,
    action: "Criar Templates",
    path: "/templates",
  },
  {
    id: 3,
    title: "Configurar Webhooks",
    description: "Integre com sua loja WooCommerce para automação completa",
    icon: Webhook,
    action: "Configurar Webhooks",
    path: "/webhooks",
  },
];

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleStepComplete = (stepId: number, path: string) => {
    setCompletedSteps(prev => [...prev, stepId]);
    setLocation(path);
  };

  const handleSkipOnboarding = () => {
    setLocation("/");
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Bem-vindo ao WhatsFlow, {user.name}! 🎉
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Sua conta foi criada com sucesso! Vamos configurar seu sistema de automação.
          </p>
          <div className="bg-white rounded-lg p-4 inline-block shadow-sm border">
            <p className="text-sm text-gray-600">
              <strong>Plano {user.plan === 'basic' ? 'Básico' : user.plan === 'pro' ? 'Pro' : 'Enterprise'}</strong> • 
              {user.company} • {user.email}
            </p>
          </div>
        </div>

        {/* Onboarding Steps */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-semibold text-center mb-6">
            Configure seu sistema em 3 passos simples:
          </h2>
          
          <div className="grid gap-6 md:grid-cols-3">
            {ONBOARDING_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.includes(step.id);
              
              return (
                <Card 
                  key={step.id} 
                  className={`relative transition-all duration-200 hover:shadow-lg ${
                    isCompleted ? 'bg-green-50 border-green-200' : 'hover:shadow-md'
                  }`}
                >
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2">
                      <CheckCircle2 className="h-6 w-6 text-green-600 bg-white rounded-full" />
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                      <Icon className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">
                      <span className="text-blue-600 font-bold">Passo {step.id}:</span> {step.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {step.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="text-center">
                    <Button 
                      onClick={() => handleStepComplete(step.id, step.path)}
                      disabled={isCompleted}
                      className="w-full"
                      data-testid={`button-step-${step.id}`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Concluído
                        </>
                      ) : (
                        <>
                          {step.action}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Progress Summary */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">Progresso da Configuração</h3>
                <p className="text-gray-600">
                  {completedSteps.length} de {ONBOARDING_STEPS.length} passos concluídos
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100)}%
                </div>
                <div className="text-sm text-gray-500">Completo</div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(completedSteps.length / ONBOARDING_STEPS.length) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {completedSteps.length === ONBOARDING_STEPS.length ? (
            <Button 
              onClick={() => setLocation("/")}
              size="lg"
              className="text-lg px-8"
              data-testid="button-go-dashboard"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Ir para o Dashboard
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => handleStepComplete(1, "/instances")}
                size="lg"
                className="text-lg px-8"
                data-testid="button-start-setup"
              >
                Começar Configuração
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button 
                onClick={handleSkipOnboarding}
                variant="outline"
                size="lg"
                className="text-lg px-8"
                data-testid="button-skip-onboarding"
              >
                Pular e Ir Direto ao Dashboard
              </Button>
            </>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            Precisa de ajuda? Entre em contato com nosso suporte em{" "}
            <a href="mailto:suporte@whatsflow.com" className="text-blue-600 hover:underline">
              suporte@whatsflow.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}