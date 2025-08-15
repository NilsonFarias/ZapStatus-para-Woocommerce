import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function SubscriptionSuccess() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');

    if (redirectStatus === 'succeeded') {
      setStatus('success');
      setMessage('Sua assinatura foi ativada com sucesso!');
    } else if (redirectStatus === 'failed') {
      setStatus('error');
      setMessage('Houve um problema com o pagamento. Tente novamente.');
    } else {
      // Verificar status do payment intent se disponível
      setStatus('success');
      setMessage('Processamento concluído!');
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-slate-600">Processando pagamento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'success' ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          )}
          <CardTitle className="text-2xl">
            {status === 'success' ? 'Pagamento Realizado!' : 'Pagamento Falhou'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600 mb-6">{message}</p>
          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full" data-testid="button-return-home">
                Voltar ao Início
              </Button>
            </Link>
            {status === 'error' && (
              <Link href="/subscribe">
                <Button variant="outline" className="w-full" data-testid="button-try-again">
                  Tentar Novamente
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}