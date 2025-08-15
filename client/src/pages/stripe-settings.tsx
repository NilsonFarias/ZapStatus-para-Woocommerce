import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard, Key, Settings, DollarSign, Shield, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const stripeConfigSchema = z.object({
  stripeSecretKey: z.string().optional().or(z.literal('')),
  stripePublicKey: z.string().optional().or(z.literal('')),
  basicPriceId: z.string().min(1, 'ID do preço do Plano Básico é obrigatório'),
  proPriceId: z.string().min(1, 'ID do preço do Plano Pro é obrigatório'),
  enterprisePriceId: z.string().min(1, 'ID do preço do Plano Enterprise é obrigatório'),
});

type StripeConfig = z.infer<typeof stripeConfigSchema>;

export default function StripeSettings() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<any>(null);

  const form = useForm<StripeConfig>({
    resolver: zodResolver(stripeConfigSchema),
    defaultValues: {
      stripeSecretKey: '',
      stripePublicKey: '',
      basicPriceId: '',
      proPriceId: '',
      enterprisePriceId: '',
    },
  });

  // Load current configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ['/api/admin/stripe-config'],
    retry: false,
  });

  useEffect(() => {
    if (config) {
      form.reset({
        stripeSecretKey: (config as any)?.stripeSecretKey || '',
        stripePublicKey: (config as any)?.stripePublicKey || '',
        basicPriceId: (config as any)?.basicPriceId || '',
        proPriceId: (config as any)?.proPriceId || '',
        enterprisePriceId: (config as any)?.enterprisePriceId || '',
      });
    }
  }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: StripeConfig) => {
      return await apiRequest('POST', '/api/admin/stripe-config', data);
    },
    onSuccess: () => {
      toast({
        title: 'Configurações Salvas',
        description: 'As configurações do Stripe foram atualizadas com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe-config'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/test-stripe-config');
    },
    onSuccess: (result) => {
      setTestResults(result);
      toast({
        title: 'Teste Concluído',
        description: 'Verificação das configurações do Stripe finalizada.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro no Teste',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: StripeConfig) => {
    saveMutation.mutate(data);
  };

  const handleTest = () => {
    testMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações do Stripe</h1>
          <p className="text-muted-foreground">
            Configure as chaves de API e IDs de preço para processamento de pagamentos
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* API Keys Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Chaves de API
                </CardTitle>
                <CardDescription>
                  Configure suas chaves de API do Stripe para autenticação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="stripeSecretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stripe Secret Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="sk_live_... ou sk_test_..."
                          data-testid="input-stripe-secret-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Chave secreta do Stripe (deve começar com sk_). Deixe vazio para manter a atual.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stripePublicKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stripe Public Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="pk_live_... ou pk_test_..."
                          data-testid="input-stripe-public-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Chave pública do Stripe (deve começar com pk_). Deixe vazio para manter a atual.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Price IDs Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  IDs de Preço dos Planos
                </CardTitle>
                <CardDescription>
                  Configure os IDs de preço do Stripe para cada plano de assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Como encontrar os IDs de preço:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Acesse o painel do Stripe Dashboard</li>
                        <li>Vá em "Produtos" no menu lateral</li>
                        <li>Clique em cada produto</li>
                        <li>Na seção "Preços", copie o ID que começa com "price_"</li>
                        <li><strong>Importante:</strong> Use price IDs, não product IDs</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="basicPriceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        Plano Básico (R$ 29/mês)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="price_1ABC123..."
                          data-testid="input-basic-price-id"
                        />
                      </FormControl>
                      <FormDescription>
                        ID do preço para o plano básico com 1.000 mensagens/mês
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proPriceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-purple-600" />
                        Plano Pro (R$ 89/mês)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="price_1DEF456..."
                          data-testid="input-pro-price-id"
                        />
                      </FormControl>
                      <FormDescription>
                        ID do preço para o plano pro com 10.000 mensagens/mês
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enterprisePriceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-green-600" />
                        Plano Enterprise (R$ 199/mês)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="price_1GHI789..."
                          data-testid="input-enterprise-price-id"
                        />
                      </FormControl>
                      <FormDescription>
                        ID do preço para o plano enterprise com mensagens ilimitadas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                data-testid="button-save-config"
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={testMutation.isPending}
                data-testid="button-test-config"
              >
                {testMutation.isPending ? 'Testando...' : 'Testar Configurações'}
              </Button>
            </div>
          </form>
        </Form>

        {/* Test Results */}
        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados do Teste</CardTitle>
              <CardDescription>
                Verificação das configurações do Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.apiConnection && (
                  <div className="flex items-center gap-2">
                    <Badge variant={testResults.apiConnection.success ? 'default' : 'destructive'}>
                      {testResults.apiConnection.success ? 'OK' : 'ERRO'}
                    </Badge>
                    <span className="text-sm">Conexão com API: {testResults.apiConnection.message}</span>
                  </div>
                )}

                {testResults.priceValidation && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Validação de Preços:</h4>
                    {Object.entries(testResults.priceValidation).map(([plan, result]: [string, any]) => (
                      <div key={plan} className="flex items-center gap-2 ml-4">
                        <Badge variant={result.valid ? 'default' : 'destructive'}>
                          {result.valid ? 'OK' : 'ERRO'}
                        </Badge>
                        <span className="text-sm">
                          {plan}: {result.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}