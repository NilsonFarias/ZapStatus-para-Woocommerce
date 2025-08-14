import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WEBHOOK_EVENTS = [
  { id: 'order_created', label: 'Pedido Criado', description: 'order.created' },
  { id: 'order_status_changed', label: 'Status Atualizado', description: 'order.status_changed' },
  { id: 'order_payment_complete', label: 'Pagamento Confirmado', description: 'order.payment_complete' },
  { id: 'order_cancelled', label: 'Pedido Cancelado', description: 'order.cancelled' },
];

export default function Webhooks() {
  const { toast } = useToast();
  
  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['/api/webhook-logs/demo-client-id'],
  });

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
            label: "Testar Webhook",
            onClick: () => console.log("Test webhook"),
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
                      value="https://api.whatsflow.com/webhook/woocommerce"
                      readOnly
                      className="bg-slate-50"
                      data-testid="input-webhook-url"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => copyToClipboard("https://api.whatsflow.com/webhook/woocommerce")}
                      data-testid="button-copy-webhook-url"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Use esta URL no seu WooCommerce</p>
                </div>

                <div>
                  <Label htmlFor="secret-key">Chave de Segurança</Label>
                  <div className="flex mt-2">
                    <Input
                      id="secret-key"
                      type="password"
                      value="sk_live_1234567890abcdef"
                      readOnly
                      className="bg-slate-50"
                      data-testid="input-secret-key"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => copyToClipboard("sk_live_1234567890abcdef")}
                      data-testid="button-copy-secret-key"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Configure no WooCommerce para autenticação</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-sm font-medium text-success">Status: Ativo</span>
                  </div>
                  <span className="text-xs text-success">Última verificação: agora</span>
                </div>
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
                <div className="space-y-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                      data-testid={`webhook-event-${event.id}`}
                    >
                      <div>
                        <p className="font-medium text-slate-900">{event.label}</p>
                        <p className="text-sm text-slate-500">{event.description}</p>
                      </div>
                      <Switch 
                        defaultChecked={event.id !== 'order_payment_complete'} 
                        data-testid={`switch-${event.id}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Logs Recentes
              </CardTitle>
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
                    {/* Mock data for demonstration */}
                    <TableRow data-testid="webhook-log-1">
                      <TableCell className="text-sm text-slate-600">
                        {new Date().toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">order.status_changed</TableCell>
                      <TableCell className="text-sm">Loja ABC</TableCell>
                      <TableCell>
                        <Badge className="bg-success/10 text-success">Sucesso</Badge>
                      </TableCell>
                      <TableCell className="text-sm">200 OK</TableCell>
                    </TableRow>
                    <TableRow data-testid="webhook-log-2">
                      <TableCell className="text-sm text-slate-600">
                        {new Date(Date.now() - 300000).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">order.created</TableCell>
                      <TableCell className="text-sm">Loja XYZ</TableCell>
                      <TableCell>
                        <Badge className="bg-error/10 text-error">Erro</Badge>
                      </TableCell>
                      <TableCell className="text-sm">500 Internal Error</TableCell>
                    </TableRow>
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
