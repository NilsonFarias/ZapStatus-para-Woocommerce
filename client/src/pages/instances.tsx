import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import InstanceCard from "@/components/instances/instance-card";
import QRModal from "@/components/instances/qr-modal";
import CreateInstanceModal from "@/components/instances/create-instance-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsappInstance, Client } from "@shared/schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Instances() {
  const { toast } = useToast();
  const [selectedInstance, setSelectedInstance] = useState<WhatsappInstance | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [qrMessage, setQrMessage] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: instances = [], isLoading } = useQuery<WhatsappInstance[]>({
    queryKey: ['/api/instances'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (instanceId: string) => apiRequest("DELETE", `/api/instances/${instanceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instances'] });
      toast({
        title: "Instância removida",
        description: "A instância foi removida com sucesso.",
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

  const getQRMutation = useMutation({
    mutationFn: (instanceId: string) => 
      apiRequest("GET", `/api/instances/${instanceId}/qr`).then(res => res.json()),
    onSuccess: (data) => {
      if (data.qrcode) {
        setQrCode(data.qrcode);
        setQrMessage("");
      } else {
        setQrCode("");
        const message = data.message || "QR Code não disponível. A instância pode estar se conectando ou já conectada.";
        setQrMessage(message);
        
        // If instance is stuck, show additional help
        if (data.status === 'stuck') {
          toast({
            title: "Instância com problema",
            description: "Esta instância parece estar travada. Recomendamos removê-la e criar uma nova.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Falha ao obter QR Code: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleShowQR = async (instance: WhatsappInstance) => {
    setSelectedInstance(instance);
    setQrModalOpen(true);
    setQrCode("");
    setQrMessage("");
    await getQRMutation.mutateAsync(instance.id);
  };

  const handleRegenerateQR = () => {
    if (selectedInstance) {
      setQrCode("");
      setQrMessage("");
      getQRMutation.mutate(selectedInstance.id);
    }
  };

  const handleDeleteInstance = async (instance: WhatsappInstance) => {
    if (confirm(`Tem certeza que deseja remover a instância "${instance.name}"?`)) {
      await deleteInstanceMutation.mutateAsync(instance.id);
    }
  };

  const testEvolutionApiMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/evolution/test").then(res => res.json()),
    onSuccess: (data) => {
      toast({
        title: "Conexão testada",
        description: data.success ? "Evolution API conectada com sucesso!" : "Falha na conexão",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no teste",
        description: `Falha na conexão com Evolution API: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Instâncias WhatsApp"
          description="Gerencie conexões WhatsApp via Evolution API"
          action={{
            label: "Nova Instância",
            onClick: () => setCreateModalOpen(true),
            icon: <Plus className="mr-2" size={16} />
          }}
        />
        
        <div className="px-6 pb-4">
          <Button 
            variant="outline" 
            onClick={() => testEvolutionApiMutation.mutate()}
            disabled={testEvolutionApiMutation.isPending}
            data-testid="button-test-evolution-api"
          >
            {testEvolutionApiMutation.isPending ? "Testando..." : "Testar Conexão Evolution API"}
          </Button>
        </div>
        
        <div className="p-6">
          {/* Instances Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance: WhatsappInstance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onShowQR={handleShowQR}
                onDelete={handleDeleteInstance}
              />
            ))}
            
            {/* Add New Instance Card */}
            <Card className="border-2 border-dashed border-slate-300 hover:border-primary transition-colors">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[280px]">
                <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center mb-4">
                  <Plus className="text-slate-500" size={24} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Criar Nova Instância</h3>
                <p className="text-sm text-slate-500 mb-4">Adicione uma nova conexão WhatsApp para um cliente</p>
                <Button 
                  onClick={() => setCreateModalOpen(true)}
                  data-testid="button-create-instance"
                >
                  Criar Instância
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <QRModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          qrCode={qrCode}
          instanceName={selectedInstance?.name}
          onRegenerate={handleRegenerateQR}
          isLoading={getQRMutation.isPending}
          message={qrMessage}
        />

        <CreateInstanceModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          clients={clients}
        />
      </main>
    </div>
  );
}
