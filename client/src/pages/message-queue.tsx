import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageQueueItem } from "@shared/schema";
import { Clock, CheckCircle, XCircle, RefreshCw, Phone, Trash2, Send, Edit3, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'sent':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <RefreshCw className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'sent':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function MessageQueue() {
  const { toast } = useToast();
  
  const { data: queueItems = [], isLoading, refetch } = useQuery<MessageQueueItem[]>({
    queryKey: ['/api/message-queue'],
    queryFn: () => apiRequest("GET", '/api/message-queue').then(res => res.json()),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => apiRequest("DELETE", `/api/message-queue/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/message-queue'] });
      toast({
        title: "Mensagem removida",
        description: "A mensagem foi removida da fila com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendMessageMutation = useMutation({
    mutationFn: (messageId: string) => apiRequest("POST", `/api/message-queue/${messageId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/message-queue'] });
      toast({
        title: "Mensagem reenviada",
        description: "A mensagem foi reagendada para envio imediato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Atualizado",
      description: "Lista de mensagens atualizada com sucesso.",
    });
  };

  const pendingCount = queueItems.filter(item => item.status === 'pending').length;
  const sentCount = queueItems.filter(item => item.status === 'sent').length;
  const failedCount = queueItems.filter(item => item.status === 'failed').length;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Fila de Mensagens" description="Acompanhe o status de envio das mensagens WhatsApp" />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Fila de Mensagens" description="Acompanhe o status de envio das mensagens WhatsApp" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Refresh Button */}
            <div className="flex items-center justify-end">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total na Fila</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="total-count">{queueItems.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600" data-testid="pending-count">{pendingCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="sent-count">{sentCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Falhas</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="failed-count">{failedCount}</div>
                </CardContent>
              </Card>
            </div>

            {/* Queue Items */}
            <Card>
              <CardHeader>
                <CardTitle>Mensagens na Fila</CardTitle>
              </CardHeader>
              <CardContent>
                {queueItems.length === 0 ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Nenhuma mensagem na fila</h3>
                    <p className="text-muted-foreground">As mensagens aparecerão aqui quando pedidos forem processados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queueItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`queue-item-${item.id}`}
                      >
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(item.status)}
                            <Badge className={getStatusColor(item.status)}>
                              {item.status === 'pending' ? 'Pendente' : 
                               item.status === 'sent' ? 'Enviada' : 'Falha'}
                            </Badge>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium" data-testid={`phone-${item.id}`}>
                                {item.recipientPhone}
                              </span>
                            </div>
                            
                            <div className="text-sm text-muted-foreground mb-2">
                              <strong>Mensagem:</strong> {item.message.substring(0, 100)}
                              {item.message.length > 100 && '...'}
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              <strong>Agendada para:</strong>{' '}
                              {formatDistance(new Date(item.scheduledFor), new Date(), {
                                addSuffix: true,
                                locale: ptBR
                              })}
                            </div>
                            
                            {item.sentAt && (
                              <div className="text-xs text-muted-foreground">
                                <strong>Enviada:</strong>{' '}
                                {formatDistance(new Date(item.sentAt), new Date(), {
                                  addSuffix: true,
                                  locale: ptBR
                                })}
                              </div>
                            )}
                            
                            {item.error && (
                              <div className="text-xs text-red-600 mt-1">
                                <strong>Erro:</strong> {item.error}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`menu-${item.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {item.status === 'pending' && (
                                <DropdownMenuItem 
                                  onClick={() => resendMessageMutation.mutate(item.id)}
                                  data-testid={`resend-${item.id}`}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Enviar Agora
                                </DropdownMenuItem>
                              )}
                              {item.status === 'failed' && (
                                <DropdownMenuItem 
                                  onClick={() => resendMessageMutation.mutate(item.id)}
                                  data-testid={`retry-${item.id}`}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Tentar Novamente
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => deleteMessageMutation.mutate(item.id)}
                                className="text-red-600"
                                data-testid={`delete-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}