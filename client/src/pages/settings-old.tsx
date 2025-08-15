import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Shield, 
  Bell, 
  Settings as SettingsIcon, 
  CreditCard, 
  Save,
  Eye,
  EyeOff,
  CheckCircle
} from "lucide-react";

const SETTINGS_MENU = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'security', label: 'Segurança', icon: Shield },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'api', label: 'API', icon: SettingsIcon },
  { id: 'billing', label: 'Faturamento', icon: CreditCard },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('profile');
  const [showApiToken, setShowApiToken] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
    phone: user?.phone || '',
    evolutionApiUrl: import.meta.env.VITE_EVOLUTION_API_URL || '',
    evolutionApiToken: import.meta.env.VITE_EVOLUTION_API_KEY || '',
    darkMode: false,
    emailNotifications: true,
    autoBackup: true,
  });
  
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error' | null>(null);
  
  // Load existing Evolution API credentials on component mount
  useEffect(() => {
    const loadEvolutionApiCredentials = async () => {
      try {
        const response = await fetch('/api/settings/evolution-api-current');
        if (response.ok) {
          const data = await response.json();
          if (data.apiUrl && data.apiToken) {
            setFormData(prev => ({
              ...prev,
              evolutionApiUrl: data.apiUrl,
              evolutionApiToken: data.apiToken
            }));
          }
        }
      } catch (error) {
        console.log('No existing credentials found');
      }
    };
    
    loadEvolutionApiCredentials();
  }, []);

  const handleSave = async () => {
    try {
      // Save Evolution API configuration
      const response = await fetch('/api/settings/evolution-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: formData.evolutionApiUrl,
          apiToken: formData.evolutionApiToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: "Configurações salvas",
        description: "Suas configurações foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Erro ao salvar as configurações. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const testEvolutionApiConnection = async () => {
    setConnectionStatus('testing');
    
    try {
      const response = await fetch('/api/settings/test-evolution-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: formData.evolutionApiUrl,
          apiToken: formData.evolutionApiToken,
        }),
      });

      if (response.ok) {
        setConnectionStatus('connected');
        toast({
          title: "Conexão bem-sucedida",
          description: "A conexão com a Evolution API foi estabelecida.",
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar com a Evolution API. Verifique as credenciais.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Erro de conexão",
        description: "Erro ao testar a conexão. Verifique a URL e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderProfileSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Informações do Perfil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              data-testid="input-name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              data-testid="input-company"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              data-testid="input-phone"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEvolutionApiSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Configuração Evolution API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="api-url">URL da API</Label>
          <Input
            id="api-url"
            value={formData.evolutionApiUrl}
            onChange={(e) => handleInputChange('evolutionApiUrl', e.target.value)}
            data-testid="input-api-url"
          />
        </div>
        <div>
          <Label htmlFor="api-token">API Token</Label>
          <div className="flex">
            <Input
              id="api-token"
              type={showApiToken ? "text" : "password"}
              value={formData.evolutionApiToken}
              onChange={(e) => handleInputChange('evolutionApiToken', e.target.value)}
              className="flex-1"
              data-testid="input-api-token"
            />
            <Button
              variant="outline"
              className="ml-2"
              onClick={() => setShowApiToken(!showApiToken)}
              data-testid="button-toggle-api-token"
            >
              {showApiToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </div>
        {connectionStatus === 'connected' && (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="text-green-600" size={16} />
              <span className="text-sm font-medium text-green-700">Conexão estabelecida</span>
            </div>
          </div>
        )}
        
        {connectionStatus === 'error' && (
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm font-medium text-red-700">Erro de conexão</span>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={testEvolutionApiConnection}
            disabled={connectionStatus === 'testing' || !formData.evolutionApiUrl || !formData.evolutionApiToken}
            data-testid="button-test-connection"
          >
            {connectionStatus === 'testing' ? 'Testando...' : 'Testar conexão'}
          </Button>
          <Button onClick={handleSave} variant="outline">
            <Save size={16} className="mr-2" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderPreferencesSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Preferências do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Modo Escuro</p>
            <p className="text-sm text-slate-500">Ativa o tema escuro da interface</p>
          </div>
          <Switch
            checked={formData.darkMode}
            onCheckedChange={(checked) => handleInputChange('darkMode', checked)}
            data-testid="switch-dark-mode"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Notificações por Email</p>
            <p className="text-sm text-slate-500">Receber relatórios e alertas por email</p>
          </div>
          <Switch
            checked={formData.emailNotifications}
            onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
            data-testid="switch-email-notifications"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Auto-backup</p>
            <p className="text-sm text-slate-500">Backup automático dos dados diariamente</p>
          </div>
          <Switch
            checked={formData.autoBackup}
            onCheckedChange={(checked) => handleInputChange('autoBackup', checked)}
            data-testid="switch-auto-backup"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {renderProfileSection()}
            {renderEvolutionApiSection()}
            {renderPreferencesSection()}
          </div>
        );
      case 'security':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Configurações de segurança em desenvolvimento...</p>
            </CardContent>
          </Card>
        );
      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Configurações de notificação em desenvolvimento...</p>
            </CardContent>
          </Card>
        );
      case 'api':
        return renderEvolutionApiSection();
      case 'billing':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Configurações de faturamento em desenvolvimento...</p>
            </CardContent>
          </Card>
        );
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header
          title="Configurações"
          description="Configure sua conta e preferências do sistema"
          action={{
            label: "Salvar Alterações",
            onClick: handleSave,
            icon: <Save className="mr-2" size={16} />
          }}
        />
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Menu */}
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-2">
                  {SETTINGS_MENU.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                          isActive 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                        data-testid={`settings-menu-${item.id}`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* Settings Content */}
            <div className="lg:col-span-2">
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
