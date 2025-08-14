import { useState } from "react";
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
    evolutionApiUrl: 'https://api.evolution.com',
    evolutionApiToken: 'evo_api_token_123456',
    darkMode: false,
    emailNotifications: true,
    autoBackup: true,
  });

  const handleSave = () => {
    toast({
      title: "Configurações salvas",
      description: "Suas configurações foram atualizadas com sucesso.",
    });
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
        <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="text-success" size={16} />
            <span className="text-sm font-medium text-success">Conexão estabelecida</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-success hover:text-success/80"
            data-testid="button-test-connection"
          >
            Testar conexão
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
        return (
          <Card>
            <CardHeader>
              <CardTitle>Configurações de API</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Configurações de API em desenvolvimento...</p>
            </CardContent>
          </Card>
        );
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
