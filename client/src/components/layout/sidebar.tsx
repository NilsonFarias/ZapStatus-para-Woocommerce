import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  BarChart3, 
  Users, 
  Smartphone, 
  Mail, 
  Webhook, 
  CreditCard, 
  Settings,
  LogOut,
  User,
  Zap
} from "lucide-react";

const adminNavigation = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/clients", label: "Clientes", icon: Users },
  { path: "/billing", label: "Faturamento", icon: CreditCard },
  { path: "/api-config", label: "API", icon: Zap },
  { path: "/settings", label: "Configurações", icon: Settings },
];

const userNavigation = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/instances", label: "Instâncias WhatsApp", icon: Smartphone },
  { path: "/templates", label: "Templates de Mensagem", icon: Mail },
  { path: "/webhooks", label: "Webhooks", icon: Webhook },
  { path: "/message-queue", label: "Fila de Mensagens", icon: MessageCircle },
  { path: "/settings", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Choose navigation based on user role
  const navigationItems = user?.role === 'admin' ? adminNavigation : userNavigation;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen" data-testid="sidebar">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <MessageCircle className="text-white" size={16} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">WhatsFlow</h1>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link href={item.path}>
                  <div 
                    className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={20} className="mr-3" />
                    {item.label}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
            <User className="text-slate-600" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate" data-testid="user-name">
              {user?.name || 'Loading...'}
            </p>
            <p className="text-xs text-slate-500" data-testid="user-plan">
              {user?.role === 'admin' ? 'Administrador' : `Plano ${user?.plan === 'pro' ? 'Pro' : user?.plan === 'enterprise' ? 'Enterprise' : 'Básico'}`}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
