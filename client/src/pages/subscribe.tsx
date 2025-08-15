import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building, AlertTriangle, Shield } from "lucide-react";

// Initialize Stripe with dynamic configuration
let stripePromise: Promise<any> | null = null;

const initializeStripe = async () => {
  try {
    // Get Stripe configuration from API
    const response = await fetch('/api/admin/stripe-config');
    const config = await response.json();
    
    const publicKey = config.stripePublicKey || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    
    if (!publicKey) {
      throw new Error('Missing Stripe public key in both database and environment variables');
    }
    
    return loadStripe(publicKey);
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    // Fallback to environment variable
    const fallbackKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!fallbackKey) {
      throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
    }
    return loadStripe(fallbackKey);
  }
};

stripePromise = initializeStripe();

const PLANS = [
  {
    id: 'basic',
    name: 'Plano Básico',
    price: 29,
    description: 'Ideal para pequenas lojas',
    icon: Shield,
    features: [
      'Até 1.000 mensagens/mês',
      '1 instância WhatsApp',
      'Templates básicos',
      'Suporte por email',
    ],
    popular: false,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'pro',
    name: 'Plano Pro',
    price: 89,
    description: 'Perfeito para lojas em crescimento',
    icon: Crown,
    features: [
      'Até 10.000 mensagens/mês',
      '1 instância WhatsApp',
      'Templates avançados',
      'Webhooks personalizados',
      'Suporte prioritário',
      'Analytics detalhados',
    ],
    popular: true,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    id: 'enterprise',
    name: 'Plano Enterprise',
    price: 199,
    description: 'Para grandes operações',
    icon: Zap,
    features: [
      'Mensagens ilimitadas',
      '1 instância WhatsApp',
      'API completa',
      'Integrações customizadas',
      'Suporte 24/7',
      'Gerente de conta dedicado',
    ],
    popular: false,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
];

const SubscribeForm = ({ selectedPlan }: { selectedPlan: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success`,
      },
    });

    if (error) {
      toast({
        title: "Falha no Pagamento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pagamento Realizado!",
        description: "Sua assinatura foi ativada com sucesso!",
      });
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || isProcessing}
        data-testid="button-subscribe"
      >
        {isProcessing ? 'Processando...' : `Assinar ${selectedPlan}`}
      </Button>
    </form>
  );
};

function PlanSelection({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {PLANS.map((plan) => {
        const Icon = plan.icon;
        return (
          <Card 
            key={plan.id} 
            className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            data-testid={`plan-card-${plan.id}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-white px-4 py-1">
                  Mais Popular
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center">
              <div className={`w-12 h-12 mx-auto ${plan.bgColor} ${plan.color} rounded-lg flex items-center justify-center mb-4`}>
                <Icon size={24} />
              </div>
              <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
              <p className="text-slate-600">{plan.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">R$ {plan.price}</span>
                <span className="text-slate-600">/mês</span>
              </div>
            </CardHeader>
            
            <CardContent>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <Check className="text-success mr-2 flex-shrink-0" size={16} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                className={`w-full ${plan.popular ? '' : 'variant-outline'}`}
                onClick={() => onSelectPlan(plan.id)}
                data-testid={`button-select-${plan.id}`}
              >
                Escolher {plan.name}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/create-subscription", {
        plan: planId,
        email: "demo@example.com", // In real app, get from user context
        name: "Demo User"
      });
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedPlan && !clientSecret && isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Preparando sua assinatura...</p>
        </div>
      </div>
    );
  }

  if (selectedPlan && clientSecret) {
    const plan = PLANS.find(p => p.id === selectedPlan);
    
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                Finalizar Assinatura
              </CardTitle>
              <p className="text-slate-600">
                {plan?.name} - R$ {plan?.price}/mês
              </p>
            </CardHeader>
            <CardContent>
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#2563EB',
                    }
                  },
                  loader: 'auto'
                }}
              >
                <SubscribeForm selectedPlan={plan?.name || ''} />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Escolha seu Plano
          </h1>
          <p className="text-xl text-slate-600">
            Automatize suas mensagens WhatsApp com WooCommerce
          </p>
        </div>
        
        <PlanSelection onSelectPlan={handleSelectPlan} />
        
        <div className="text-center text-sm text-slate-500">
          <p>Cancele a qualquer momento, sem taxas de cancelamento</p>
        </div>
      </div>
    </div>
  );
}
