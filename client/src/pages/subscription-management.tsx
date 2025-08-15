import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, AlertTriangle, CheckCircle, RefreshCw, XCircle, Calendar } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SubscriptionDetails {
  hasSubscription: boolean;
  subscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    canceledAt?: string | null;
  };
  plan: string;
  subscriptionStatus: string;
}

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelType, setCancelType] = useState('period_end');

  // Fetch subscription details
  const { data: subscriptionData, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription-details"],
    retry: false,
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ cancelImmediately, reason }: { cancelImmediately: boolean; reason: string }) => {
      return apiRequest("POST", "/api/cancel-subscription", { cancelImmediately, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsCancelDialogOpen(false);
      setCancelReason('');
      toast({
        title: "Assinatura cancelada",
        description: cancelType === 'immediately' 
          ? "Sua assinatura foi cancelada imediatamente."
          : "Sua assinatura será cancelada no final do período atual.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    },
  });

  // Reactivate subscription mutation
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/reactivate-subscription");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Assinatura reativada",
        description: "Sua assinatura foi reativada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível reativar a assinatura.",
        variant: "destructive",
      });
    },
  });

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o motivo do cancelamento.",
        variant: "destructive",
      });
      return;
    }

    cancelMutation.mutate({
      cancelImmediately: cancelType === 'immediately',
      reason: cancelReason,
    });
  };

  const handleReactivate = () => {
    reactivateMutation.mutate();
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'basic': return 'secondary';
      case 'pro': return 'default';
      case 'enterprise': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'cancel_at_period_end': return 'secondary';
      case 'canceled': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'cancel_at_period_end': return 'Cancelamento Agendado';
      case 'canceled': return 'Cancelada';
      default: return status;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não disponível';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!subscriptionData?.hasSubscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Gerenciar Assinatura
          </CardTitle>
          <CardDescription>
            Você não possui uma assinatura ativa no momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            Para acessar recursos premium e aumentar seus limites de mensagens, considere fazer uma assinatura.
          </p>
          <Button data-testid="button-subscribe">
            Escolher Plano
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { subscription, plan, subscriptionStatus } = subscriptionData;

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Status da Assinatura
          </CardTitle>
          <CardDescription>
            Detalhes da sua assinatura atual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Plano Atual</Label>
              <div className="mt-1">
                <Badge variant={getPlanBadgeVariant(plan)} className="capitalize">
                  {plan}
                </Badge>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-slate-600">Status</Label>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(subscriptionStatus)}>
                  {getStatusText(subscriptionStatus)}
                </Badge>
              </div>
            </div>
          </div>

          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium text-slate-600">Início do Período</Label>
                <p className="text-sm mt-1">{formatDate(subscription.currentPeriodStart)}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-slate-600">
                  {subscription.cancelAtPeriodEnd ? 'Cancelamento em' : 'Próxima Cobrança'}
                </Label>
                <p className="text-sm mt-1">{formatDate(subscription.currentPeriodEnd)}</p>
              </div>
            </div>
          )}

          {subscription?.canceledAt && (
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium text-slate-600">Data do Cancelamento</Label>
              <p className="text-sm mt-1">{formatDate(subscription.canceledAt)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações da Assinatura</CardTitle>
          <CardDescription>
            Gerencie sua assinatura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription?.cancelAtPeriodEnd ? (
            // Reactivate option
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900">Cancelamento Agendado</h4>
                <p className="text-sm text-orange-700 mt-1">
                  Sua assinatura será cancelada em {formatDate(subscription.currentPeriodEnd)}. 
                  Você pode reativar até esta data.
                </p>
                <Button
                  onClick={handleReactivate}
                  disabled={reactivateMutation.isPending}
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  data-testid="button-reactivate"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {reactivateMutation.isPending ? "Reativando..." : "Reativar Assinatura"}
                </Button>
              </div>
            </div>
          ) : subscriptionStatus === 'active' ? (
            // Cancel option
            <div className="space-y-3">
              <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-cancel-subscription">
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar Assinatura
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cancelar Assinatura</DialogTitle>
                    <DialogDescription>
                      Lamentamos que você queira cancelar. Por favor, nos diga o motivo.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="reason">Motivo do Cancelamento *</Label>
                      <Textarea
                        id="reason"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Por favor, nos diga por que está cancelando..."
                        rows={3}
                        data-testid="textarea-cancel-reason"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Quando cancelar?</Label>
                      <RadioGroup 
                        value={cancelType} 
                        onValueChange={setCancelType}
                        data-testid="radio-cancel-type"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="period_end" id="period_end" />
                          <Label htmlFor="period_end" className="text-sm">
                            No final do período atual ({subscription && formatDate(subscription.currentPeriodEnd)})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="immediately" id="immediately" />
                          <Label htmlFor="immediately" className="text-sm">
                            Imediatamente (perderá acesso agora)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleCancel}
                        disabled={cancelMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                        data-testid="button-confirm-cancel"
                      >
                        {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsCancelDialogOpen(false)}
                        data-testid="button-cancel-cancel"
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <p className="text-sm text-slate-600">
                Cancelar sua assinatura fará com que você retorne ao plano básico com limitações de uso.
              </p>
            </div>
          ) : (
            // Subscription canceled
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900">Assinatura Cancelada</h4>
                <p className="text-sm text-red-700 mt-1">
                  Sua assinatura foi cancelada. Para reativar os recursos premium, faça uma nova assinatura.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  data-testid="button-new-subscription"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Nova Assinatura
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Precisa de Ajuda?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Se você tiver dúvidas sobre sua assinatura ou precisar de suporte, entre em contato conosco.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-support">
              Falar com Suporte
            </Button>
            <Button variant="outline" size="sm" data-testid="button-billing-history">
              <Calendar className="mr-2 h-4 w-4" />
              Histórico de Pagamentos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}