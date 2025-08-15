import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, TestTube } from "lucide-react";

interface EvolutionApiConfig {
  apiUrl: string;
  apiToken: string;
}

export default function ApiConfig() {
  const { toast } = useToast();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: config, isLoading } = useQuery<EvolutionApiConfig>({
    queryKey: ["/api/settings/evolution-api-current"],
  });

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/evolution-api", { apiUrl, apiToken: apiKey });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "Configuração da Evolution API foi salva com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/evolution-api-current"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: testConnection, isPending: isTesting } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/test-evolution-api", { apiUrl, apiToken: apiKey });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Sucesso" : "Erro",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize form when config loads
  React.useEffect(() => {
    if (config && !apiUrl && !apiKey) {
      setApiUrl(config.apiUrl || "");
      setApiKey(config.apiToken || "");
    }
  }, [config, apiUrl, apiKey]);

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
          title="Configuração de API"
          description="Configure as integrações com APIs externas"
        />
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolution API</CardTitle>
              <CardDescription>
                Configure a conexão com o servidor Evolution API para gerenciar instâncias WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">URL da API</Label>
                <Input
                  id="api-url"
                  placeholder="https://evolution-api.exemplo.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  data-testid="input-api-url"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-key">Chave da API</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sua-chave-da-api"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  data-testid="input-api-key"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => saveConfig()}
                  disabled={isSaving || !apiUrl || !apiKey}
                  data-testid="button-save-config"
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => testConnection()}
                  disabled={isTesting || !config}
                  data-testid="button-test-connection"
                >
                  {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <TestTube className="mr-2 h-4 w-4" />
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}