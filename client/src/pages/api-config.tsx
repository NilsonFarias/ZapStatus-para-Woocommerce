import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface EvolutionApiConfig {
  apiUrl: string;
  apiKey: string;
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
      return await apiRequest("/api/settings/evolution-api", "POST", { apiUrl, apiKey });
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
      return await apiRequest("/api/settings/test-evolution-api", "POST");
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
      setApiKey(config.apiKey || "");
    }
  }, [config, apiUrl, apiKey]);

  return (
    <div className="space-y-6" data-testid="api-config-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração de API</h1>
        <p className="text-muted-foreground">
          Configure as integrações com APIs externas
        </p>
      </div>

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
              Salvar Configuração
            </Button>
            
            <Button
              variant="outline"
              onClick={() => testConnection()}
              disabled={isTesting || !config}
              data-testid="button-test-connection"
            >
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}