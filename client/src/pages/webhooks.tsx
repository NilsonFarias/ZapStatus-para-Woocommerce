import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, TestTube, Save, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const WEBHOOK_EVENTS = [
  { id: 'order.created', label: 'Pedido Criado', description: 'Quando um novo pedido é criado' },
  { id: 'order.updated', label: 'Pedido Atualizado', description: 'Quando qualquer informação do pedido é alterada' },
  { id: 'order.pending', label: 'Aguardando Pagamento', description: 'Status: Aguardando pagamento' },
  { id: 'order.processing', label: 'Processando', description: 'Status: Processando pedido' },
  { id: 'order.on-hold', label: 'Em Espera', description: 'Status: Em espera' },
  { id: 'order.completed', label: 'Concluído', description: 'Status: Pedido concluído' },
  { id: 'order.cancelled', label: 'Cancelado', description: 'Status: Pedido cancelado' },
  { id: 'order.refunded', label: 'Reembolsado', description: 'Status: Pedido reembolsado' },
  { id: 'order.failed', label: 'Falha', description: 'Status: Falha no pagamento' },
  { id: 'order.shipped', label: 'Enviado', description: 'Status: Pedido enviado' },
  { id: 'order.delivered', label: 'Entregue', description: 'Status: Pedido entregue' },
];

export default function Webhooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clientId = "demo-client-id";
  
  const [webhookConfig, setWebhookConfig] = useState({
    webhookUrl: '',
    secretKey: '',
    isActive: true,
    events: [] as string[]
  });
  
  const [isTesting, setIsTesting] = useState(false);
  
  const { data: existingConfig } = useQuery({
    queryKey: [`/api/webhook-config/${clientId}`],
  });
  
  const { data: webhookLogs = [] } = useQuery({
    queryKey: [`/api/webhook-logs/${clientId}`],
  });

  // Load existing configuration
  useEffect(() => {
    if (existingConfig) {
      setWebhookConfig({
        webhookUrl: existingConfig.webhookUrl || '',
        secretKey: existingConfig.secretKey || '',
        isActive: existingConfig.isActive ?? true,
        events: existingConfig.events || []
      });
    } else {
      // Set default webhook URL - use Replit's public URL
      const replitUrl = window.location.origin.includes('localhost') 
        ? 'https://c737058c-1d7a-400d-b9a5-fffce39cea32-00-1tblbex3jars3.worf.replit.dev' 
        : window.location.origin;
      
      setWebhookConfig(prev => ({
        ...prev,
        webhookUrl: `${replitUrl}/api/webhook/woocommerce`,
        secretKey: generateSecretKey()
      }));
    }
  }, [existingConfig]);

  const generateSecretKey = () => {
    return 'whatsflow_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const saveConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      // Ensure events is an array and properly formatted
      const payload = {
        clientId,
        webhookUrl: config.webhookUrl,
        secretKey: config.secretKey,
        isActive: config.isActive,
        events: Array.isArray(config.events) ? config.events : []
      };
      
      if (existingConfig) {
        return apiRequest("PUT", `/api/webhook-config/${existingConfig.id}`, payload);
      } else {
        return apiRequest("POST", "/api/webhook-config", payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "Webhook configurado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/webhook-config/${clientId}`] });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Erro ao salvar configurações do webhook.",
        variant: "destructive",
      });
    }
  });

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/webhook/test", {
        clientId,
        webhookUrl: webhookConfig.webhookUrl,
        secretKey: webhookConfig.secretKey
      });
    },
    onSuccess: () => {
      toast({
        title: "Teste bem-sucedido",
        description: "Webhook está funcionando corretamente!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/webhook-logs/${clientId}`] });
    },
    onError: () => {
      toast({
        title: "Falha no teste",
        description: "Erro ao testar webhook. Verifique a configuração.",
        variant: "destructive",
      });
    }
  });

  const handleSaveConfig = () => {
    if (!webhookConfig.webhookUrl || !webhookConfig.secretKey) {
      toast({
        title: "Campos obrigatórios",
        description: "URL do webhook e chave secreta são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    
    saveConfigMutation.mutate(webhookConfig);
  };

  const handleTestWebhook = () => {
    setIsTesting(true);
    testWebhookMutation.mutate();
    setTimeout(() => setIsTesting(false), 2000);
  };

  const handleEventToggle = (eventId: string, checked: boolean) => {
    setWebhookConfig(prev => ({
      ...prev,
      events: checked 
        ? [...prev.events, eventId]
        : prev.events.filter(e => e !== eventId)
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência.",
      });
    });
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Configuração de Webhooks"
          description="Configure a integração com WooCommerce"
          action={{
            label: isTesting ? "Testando..." : "Testar Webhook",
            onClick: handleTestWebhook,
            disabled: isTesting || testWebhookMutation.isPending,
            icon: <TestTube className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Webhook Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Configuração do Endpoint
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="webhook-url">URL do Webhook</Label>
                  <div className="flex mt-2">
                    <Input
                      id="webhook-url"
                      value={webhookConfig.webhookUrl}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                      placeholder="https://c737058c-1d7a-400d-b9a5-fffce39cea32-00-1tblbex3jars3.worf.replit.dev/api/webhook/woocommerce"
                      data-testid="input-webhook-url"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => copyToClipboard(webhookConfig.webhookUrl)}
                      data-testid="button-copy-webhook-url"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Use esta URL no seu WooCommerce</p>
                </div>

                <div>
                  <Label htmlFor="secret-key">Chave Secreta</Label>
                  <div className="flex mt-2">
                    <Input
                      id="secret-key"
                      value={webhookConfig.secretKey}
                      onChange={(e) => setWebhookConfig(prev => ({ ...prev, secretKey: e.target.value }))}
                      placeholder="whatsflow_secret_key"
                      data-testid="input-secret-key"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => copyToClipboard(webhookConfig.secretKey)}
                      data-testid="button-copy-secret-key"
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => setWebhookConfig(prev => ({ ...prev, secretKey: generateSecretKey() }))}
                      data-testid="button-regenerate-secret"
                    >
                      Gerar Nova
                    </Button>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Use esta chave no WooCommerce para autenticar os webhooks
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Webhook Ativo</Label>
                    <p className="text-sm text-slate-500">Ativar/desativar o recebimento de webhooks</p>
                  </div>
                  <Switch
                    checked={webhookConfig.isActive}
                    onCheckedChange={(checked) => setWebhookConfig(prev => ({ ...prev, isActive: checked }))}
                    data-testid="switch-webhook-active"
                  />
                </div>

                <Button 
                  onClick={handleSaveConfig}
                  disabled={saveConfigMutation.isPending}
                  className="w-full"
                >
                  <Save size={16} className="mr-2" />
                  {saveConfigMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
                </Button>
              </CardContent>
            </Card>

            {/* Events Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Eventos Monitorados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{event.label}</p>
                        <p className="text-sm text-slate-500">{event.description}</p>
                      </div>
                      <Switch
                        checked={webhookConfig.events.includes(event.id)}
                        onCheckedChange={(checked) => handleEventToggle(event.id, checked)}
                        data-testid={`switch-${event.id}`}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="text-blue-600 mt-0.5" size={16} />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Configuração WooCommerce</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Configure estes eventos no seu WooCommerce em: 
                          <strong> WooCommerce → Configurações → Avançado → Webhooks</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="text-green-600 mt-0.5" size={16} />
                      <div>
                        <p className="text-sm font-medium text-green-800">Como verificar se está funcionando</p>
                        <ul className="text-sm text-green-700 mt-1 space-y-1">
                          <li>• Use o botão "Testar Webhook" acima</li>
                          <li>• Verifique os logs abaixo após cada teste</li>
                          <li>• Faça um pedido teste no WooCommerce</li>
                          <li>• Monitore os logs em tempo real</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Webhook Logs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Logs Recentes ({webhookLogs.length} eventos)
              </CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600">Monitorando em tempo real</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resposta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhookLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          <div>
                            <AlertCircle className="mx-auto mb-2" size={24} />
                            <p>Nenhum evento recebido ainda</p>
                            <p className="text-sm mt-1">Use o botão "Testar Webhook" ou configure no WooCommerce</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      webhookLogs.map((log: any) => (
                        <TableRow key={log.id} data-testid={`webhook-log-${log.id}`}>
                          <TableCell className="text-sm text-slate-600">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{log.event}</TableCell>
                          <TableCell className="text-sm">Cliente Demo</TableCell>
                          <TableCell>
                            <Badge className={
                              log.status === 'success' || log.status === 'received' 
                                ? "bg-green-100 text-green-800" 
                                : "bg-red-100 text-red-800"
                            }>
                              {log.status === 'received' ? 'Sucesso' : 
                               log.status === 'success' ? 'Sucesso' : 'Erro'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.response}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
