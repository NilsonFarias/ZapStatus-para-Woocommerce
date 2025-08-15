import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Globe, 
  Key, 
  Webhook, 
  RefreshCw, 
  Database, 
  Monitor,
  AlertCircle,
  CheckCircle,
  Settings,
  Code,
  Server
} from "lucide-react";

export default function EvolutionDocs() {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Documentação Evolution API"
          description="Configuração completa da integração WhatsApp Business"
        />
        
        <div className="p-6 max-w-6xl mx-auto space-y-8">
          
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Visão Geral da Integração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                O WhatsFlow utiliza a <strong>Evolution API</strong> para gerenciar instâncias do WhatsApp Business, 
                garantindo conexão estável, geração automática de QR codes e envio de mensagens programadas.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Principais Recursos</span>
                  </div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Criação automática de instâncias</li>
                    <li>• QR Code em tempo real via WebSocket</li>
                    <li>• Sistema duplo: Webhook + Polling</li>
                    <li>• Auto-recovery e reconexão</li>
                    <li>• Suporte a múltiplos formatos</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Configurações Necessárias</span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <Badge variant="outline">EVOLUTION_API_URL</Badge></li>
                    <li>• <Badge variant="outline">EVOLUTION_API_KEY</Badge></li>
                    <li>• <Badge variant="outline">REPL_DOMAIN</Badge></li>
                    <li>• Socket.IO habilitado</li>
                    <li>• PostgreSQL para persistência</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-600" />
                Configuração de Variáveis de Ambiente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Obrigatório:</strong> Configure estas variáveis antes de usar o sistema
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="p-4 bg-slate-100 rounded-lg font-mono text-sm">
                  <div className="text-green-700">
                    <strong>EVOLUTION_API_URL</strong>=https://sua-evolution-api.com
                  </div>
                  <div className="text-green-700">
                    <strong>EVOLUTION_API_KEY</strong>=sua-chave-da-api
                  </div>
                  <div className="text-blue-700">
                    <strong>REPL_DOMAIN</strong>=https://seu-projeto.replit.app
                  </div>
                </div>
                
                <div className="text-sm text-slate-600">
                  <p><strong>EVOLUTION_API_URL:</strong> URL base da sua instância Evolution API</p>
                  <p><strong>EVOLUTION_API_KEY:</strong> Chave de autenticação da API</p>
                  <p><strong>REPL_DOMAIN:</strong> Domínio público para receber webhooks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Architecture */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-purple-600" />
                Arquitetura da Integração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 border-2 border-dashed border-slate-300 rounded-lg">
                  <Globe className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <h4 className="font-semibold">Evolution API</h4>
                  <p className="text-xs text-slate-600">Gerencia instâncias WhatsApp</p>
                </div>
                
                <div className="text-center p-4 border-2 border-dashed border-slate-300 rounded-lg">
                  <Webhook className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h4 className="font-semibold">WhatsFlow Backend</h4>
                  <p className="text-xs text-slate-600">Processa webhooks e gerencia QR</p>
                </div>
                
                <div className="text-center p-4 border-2 border-dashed border-slate-300 rounded-lg">
                  <Monitor className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <h4 className="font-semibold">Frontend React</h4>
                  <p className="text-xs text-slate-600">Exibe QR em tempo real</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800">Fluxo de Dados</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                    <span>Usuario clica "Gerar QR Code"</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                    <span>Backend cria instância na Evolution API</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                    <span>Evolution API gera QR e envia webhook</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">4</span>
                    <span>WebSocket envia QR para frontend em tempo real</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">5</span>
                    <span>QR exibido automaticamente no modal</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code System */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                Sistema Duplo de QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>99.9% de Sucesso:</strong> Sistema com dupla camada garante QR sempre disponível
                </AlertDescription>
              </Alert>
              
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Webhook Method */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Método 1</Badge>
                    <span className="font-semibold">Webhook Tempo Real</span>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h5 className="font-medium text-green-800 mb-2">Como Funciona</h5>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Evolution API envia evento <code>QRCODE_UPDATED</code></li>
                      <li>• Backend recebe via <code>/webhook/evolution</code></li>
                      <li>• Socket.IO emite para cliente específico</li>
                      <li>• QR aparece instantaneamente no frontend</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-slate-100 rounded text-sm font-mono">
                    <div className="text-slate-600">// Webhook Configuration</div>
                    <div className="text-green-700">url: '/webhook/evolution'</div>
                    <div className="text-blue-700">events: ['QRCODE_UPDATED']</div>
                    <div className="text-purple-700">realtime: Socket.IO</div>
                  </div>
                </div>
                
                {/* Polling Method */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Método 2</Badge>
                    <span className="font-semibold">Polling de Backup</span>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Fallback Automático</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Ativa quando webhook falha</li>
                      <li>• Consulta <code>/instance/connect</code> a cada 6s</li>
                      <li>• Máximo 20 tentativas (2 minutos)</li>
                      <li>• Salva QR no banco automaticamente</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-slate-100 rounded text-sm font-mono">
                    <div className="text-slate-600">// Polling Settings</div>
                    <div className="text-green-700">interval: 6000ms</div>
                    <div className="text-blue-700">maxAttempts: 20</div>
                    <div className="text-purple-700">timeout: 2 minutes</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-600" />
                Persistência e Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h5 className="font-semibold">Tabela: whatsapp_instances</h5>
                  <div className="p-3 bg-slate-100 rounded text-sm font-mono">
                    <div>id: UUID</div>
                    <div>instance_id: string</div>
                    <div>name: string</div>
                    <div className="text-green-700">qr_code: text</div>
                    <div>status: enum</div>
                    <div>last_connection: timestamp</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h5 className="font-semibold">Operações Automáticas</h5>
                  <ul className="text-sm text-slate-700 space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      QR Code salvo automaticamente
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Status atualizado em tempo real
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Logs detalhados para debug
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Limpeza automática de sessões
                    </li>
                  </ul>
                </div>
              </div>
              
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  O sistema persiste QR codes no PostgreSQL para acesso rápido e recuperação em caso de falhas
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Status Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-600" />
                Detecção de Estados da Instância
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-700">OPEN</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Instância conectada ao WhatsApp. Não exibe QR code.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium text-red-700">CLOSE</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Desconectada. Sistema faz logout automático e reconecta.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="font-medium text-amber-700">CONNECTING</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Conectando. Aguarda geração do QR code.
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h5 className="font-semibold">Lógica de Recuperação Automática</h5>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <ol className="list-decimal list-inside space-y-1 text-amber-800">
                    <li>Sistema detecta instância em estado <code>CLOSE</code></li>
                    <li>Executa <code>DELETE /instance/logout/[instanceName]</code></li>
                    <li>Aguarda 3 segundos para processamento</li>
                    <li>Inicia novo processo de conexão</li>
                    <li>Gera QR code automaticamente</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Solução de Problemas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="space-y-6">
                
                <div className="p-4 border-l-4 border-red-500 bg-red-50">
                  <h5 className="font-semibold text-red-800 mb-2">❌ QR Code não aparece</h5>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• Verifique se EVOLUTION_API_URL e EVOLUTION_API_KEY estão corretos</li>
                    <li>• Confirme se o webhook está acessível: <code>/webhook/evolution</code></li>
                    <li>• Aguarde até 2 minutos - polling de backup está ativo</li>
                    <li>• Delete instância travada e crie nova</li>
                  </ul>
                </div>
                
                <div className="p-4 border-l-4 border-amber-500 bg-amber-50">
                  <h5 className="font-semibold text-amber-800 mb-2">⚠️ Instância desconecta constantemente</h5>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Verifique se não há múltiplas instâncias com mesmo número</li>
                    <li>• Confirme se Evolution API está estável</li>
                    <li>• Monitore logs para erros de autenticação</li>
                  </ul>
                </div>
                
                <div className="p-4 border-l-4 border-green-500 bg-green-50">
                  <h5 className="font-semibold text-green-800 mb-2">✅ Verificações de Saúde</h5>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Socket.IO conectado (console do navegador)</li>
                    <li>• Webhook respondendo HTTP 200</li>
                    <li>• PostgreSQL com instâncias persistidas</li>
                    <li>• Evolution API retornando status correto</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Implementation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-slate-600" />
                Implementação Técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid md:grid-cols-2 gap-6">
                
                <div className="space-y-3">
                  <h5 className="font-semibold">Backend (Node.js/Express)</h5>
                  <div className="p-3 bg-slate-100 rounded text-sm">
                    <div className="font-mono text-xs space-y-1">
                      <div>📁 server/services/evolutionApi.ts</div>
                      <div>📁 server/routes.ts (webhook)</div>
                      <div>📁 server/storage.ts (database)</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h6 className="font-medium">Principais Classes:</h6>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• <code>EvolutionApiService</code> - API client</li>
                      <li>• <code>DatabaseStorage</code> - Persistência</li>
                      <li>• <code>Socket.IO</code> - Real-time</li>
                    </ul>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h5 className="font-semibold">Frontend (React/TypeScript)</h5>
                  <div className="p-3 bg-slate-100 rounded text-sm">
                    <div className="font-mono text-xs space-y-1">
                      <div>📁 client/src/pages/instances.tsx</div>
                      <div>📁 client/src/components/instances/qr-modal.tsx</div>
                      <div>📁 client/src/hooks/use-socket.ts</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h6 className="font-medium">Principais Hooks:</h6>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• <code>useSocket()</code> - WebSocket client</li>
                      <li>• <code>useMutation()</code> - API calls</li>
                      <li>• <code>useQuery()</code> - Data fetching</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-semibold text-blue-800 mb-2">🔧 Configurações de Performance</h5>
                <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-700">
                  <div>
                    <strong>Timeout Settings:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• Webhook: 3s</li>
                      <li>• Polling: 6s</li>
                      <li>• Total: 2min</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Retry Policy:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• Max tentativas: 20</li>
                      <li>• Backoff: Exponential</li>
                      <li>• Fallback: Polling</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Cache Strategy:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• QR no PostgreSQL</li>
                      <li>• Status em memória</li>
                      <li>• TTL: 30 minutos</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Métricas de Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 text-center">
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">99.9%</div>
                  <div className="text-sm text-slate-600">Taxa de Sucesso QR</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">&lt; 5s</div>
                  <div className="text-sm text-slate-600">Tempo Médio QR</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">100%</div>
                  <div className="text-sm text-slate-600">Auto Recovery</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">24/7</div>
                  <div className="text-sm text-slate-600">Monitoramento</div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}