import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Copy, 
  Server, 
  Container,
  Settings,
  BookOpen,
  ExternalLink
} from "lucide-react";

interface DocumentationFile {
  name: string;
  title: string;
  description: string;
  content: string;
  icon: React.ElementType;
  category: 'deployment' | 'setup' | 'guide';
}

const documentationFiles: DocumentationFile[] = [
  {
    name: 'vps-install-guide.md',
    title: 'Instalação VPS Ubuntu 22.04+',
    description: 'Guia completo para instalação direta em servidor Ubuntu com máxima performance',
    content: `# WhatsFlow - Instalação VPS Ubuntu 22.04+

## 1. Preparar Servidor

### Conectar no servidor:
\`\`\`bash
ssh root@SEU_IP_VPS
\`\`\`

### Atualizar sistema:
\`\`\`bash
apt update && apt upgrade -y
\`\`\`

### Criar usuário não-root:
\`\`\`bash
adduser whatsflow
usermod -aG sudo whatsflow
su - whatsflow
\`\`\`

## 2. Instalar Node.js 18+

\`\`\`bash
# Instalar Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versão
node --version  # deve ser 18+
npm --version
\`\`\`

## 3. Instalar PostgreSQL

\`\`\`bash
# Instalar PostgreSQL 15
sudo apt install postgresql postgresql-contrib -y

# Configurar usuário e banco
sudo -u postgres psql
\`\`\`

**No console PostgreSQL:**
\`\`\`sql
CREATE USER whatsflow WITH PASSWORD 'senha_super_forte_123';
CREATE DATABASE whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;
ALTER USER whatsflow CREATEDB;
\\\\q
\`\`\`

## 4. Instalar PM2 (Process Manager)

\`\`\`bash
sudo npm install -g pm2
\`\`\`

## 5. Clonar e Configurar Projeto

\`\`\`bash
# Clonar repositório
git clone https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
cd ZapStatus-para-Woocommerce

# Instalar dependências
npm install

# Criar arquivo de ambiente
cp .env.example .env
nano .env
\`\`\`

**Configurar .env:**
\`\`\`env
# Database
DATABASE_URL=postgresql://whatsflow:senha_super_forte_123@localhost:5432/whatsflow

# Stripe (suas chaves reais)
STRIPE_SECRET_KEY=sk_live_SEU_STRIPE_SECRET
VITE_STRIPE_PUBLIC_KEY=pk_live_SEU_STRIPE_PUBLIC
STRIPE_BASIC_PRICE_ID=price_BASIC_ID
STRIPE_PRO_PRICE_ID=price_PRO_ID
STRIPE_ENTERPRISE_PRICE_ID=price_ENTERPRISE_ID

# Evolution API (sua configuração)
EVOLUTION_API_KEY=SUA_API_KEY
EVOLUTION_API_URL=https://sua-evolution-api.com

# Session (gerar chave aleatória de 64+ caracteres)
SESSION_SECRET=sua_chave_super_secreta_aleatoria_de_64_caracteres_minimo_aqui

# Environment
NODE_ENV=production
PORT=5000
\`\`\`

## 6. Build e Migração

\`\`\`bash
# Fazer build da aplicação
npm run build

# Executar migrações do banco
npm run migrate
\`\`\`

## 7. Configurar PM2

\`\`\`bash
# Iniciar aplicação com PM2
pm2 start npm --name "whatsflow" -- start

# Configurar para iniciar automaticamente
pm2 startup
pm2 save

# Verificar status
pm2 status
pm2 logs whatsflow
\`\`\`

## 8. Instalar e Configurar Nginx

\`\`\`bash
# Instalar Nginx
sudo apt install nginx -y

# Criar configuração
sudo nano /etc/nginx/sites-available/whatsflow
\`\`\`

**Configuração Nginx:**
\`\`\`nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout       605;
        proxy_send_timeout          605;
        proxy_read_timeout          605;
        send_timeout                605;
        keepalive_timeout           605;
    }
}
\`\`\`

**Ativar site:**
\`\`\`bash
sudo ln -s /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
\`\`\`

## 9. Configurar SSL com Let's Encrypt

\`\`\`bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Configurar SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
\`\`\`

## 10. Configurar Firewall

\`\`\`bash
# Configurar UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
\`\`\`

## 11. Verificação Final

### Testar aplicação:
\`\`\`bash
# Verificar se está rodando
curl http://localhost:5000

# Verificar logs
pm2 logs whatsflow

# Status dos serviços
sudo systemctl status postgresql
sudo systemctl status nginx
pm2 status
\`\`\`

### Acessar aplicação:
- HTTP: http://seudominio.com
- HTTPS: https://seudominio.com

## 12. Comandos Úteis

### Gerenciar aplicação:
\`\`\`bash
# Restart
pm2 restart whatsflow

# Parar
pm2 stop whatsflow

# Logs em tempo real
pm2 logs whatsflow --lines 100

# Monitoramento
pm2 monit
\`\`\`

### Backup banco:
\`\`\`bash
pg_dump -U whatsflow whatsflow > backup_$(date +%Y%m%d).sql
\`\`\`

### Update aplicação:
\`\`\`bash
cd /home/whatsflow/whatsflow
git pull origin main
npm install
npm run build
npm run migrate
pm2 restart whatsflow
\`\`\`

## 13. Custos Estimados

- **VPS 2GB RAM**: US$ 5-10/mês (Hetzner, DigitalOcean)
- **Domínio**: US$ 12/ano
- **Total**: ~US$ 6-11/mês vs US$ 182 no Replit!

---

**Pronto!** Sua aplicação WhatsFlow estará rodando com máxima performance em VPS dedicada.`,
    icon: Server,
    category: 'deployment'
  },
  {
    name: 'easypanel-setup.md',
    title: 'Deploy no Easypanel',
    description: 'Instalação simplificada usando painel visual com containers Docker',
    content: `# WhatsFlow - Deploy no Easypanel

## 1. Preparar o Repositório

### Fazer upload do código para GitHub:
\`\`\`bash
git add .
git commit -m "Preparar deploy Easypanel"
git push origin main
\`\`\`

## 2. Configurar no Easypanel

### 2.1. Criar Nova Aplicação
- Entre no Easypanel
- Clique em "Create" → "App"
- Nome: whatsflow
- Tipo: "App from Source"

### 2.2. Configurar Source
- Repository: https://github.com/NilsonFarias/ZapStatus-para-Woocommerce
- Branch: main
- Build Command: npm run build
- Start Command: npm start

### 2.3. Configurar Banco PostgreSQL
- No mesmo projeto, criar "Database"
- Tipo: PostgreSQL
- Nome: whatsflow-db
- Usuário: whatsflow
- Senha: senha_segura_123

## 3. Variáveis de Ambiente

### No painel da aplicação, adicionar:

\`\`\`env
# Database (usar URL gerada pelo Easypanel)
DATABASE_URL=postgresql://whatsflow:senha_segura_123@whatsflow-db:5432/whatsflow

# Stripe (suas chaves reais)
STRIPE_SECRET_KEY=sk_live_SEU_STRIPE_SECRET
VITE_STRIPE_PUBLIC_KEY=pk_live_SEU_STRIPE_PUBLIC
STRIPE_BASIC_PRICE_ID=price_BASIC_ID
STRIPE_PRO_PRICE_ID=price_PRO_ID
STRIPE_ENTERPRISE_PRICE_ID=price_ENTERPRISE_ID

# Evolution API (sua configuração)
EVOLUTION_API_KEY=SUA_API_KEY
EVOLUTION_API_URL=https://sua-evolution-api.com

# Session (gerar chave aleatória forte)
SESSION_SECRET=sua_chave_super_secreta_aqui_64_caracteres_minimo

# Environment
NODE_ENV=production
\`\`\`

## 4. Configurar Domínio

### No painel do Easypanel:
- Ir em "Domains"
- Adicionar domínio: seusite.com
- SSL será configurado automaticamente

## 5. Deploy

### Processo automático:
1. Easypanel detecta mudanças no GitHub
2. Builda aplicação automaticamente
3. Cria containers Docker
4. Configura rede entre app e banco
5. Ativa SSL

## 6. Pós-Deploy

### Executar migrações do banco:
\`\`\`bash
# No terminal do container (via Easypanel)
npm run migrate
\`\`\`

### Verificar saúde da aplicação:
- Acessar: https://seusite.com
- Teste login/cadastro
- Verificar conexão Evolution API

## 7. Custos Estimados

- **VPS 2GB RAM**: US$ 8-12/mês
- **Domínio**: US$ 12/ano
- **Total**: ~US$ 10/mês vs US$ 182 no Replit!

## 8. Backup & Monitoramento

### Backup automático (Easypanel):
- Banco PostgreSQL: backup diário
- Código: versionado no Git
- Logs: disponíveis no painel

### Monitoramento incluído:
- CPU, RAM, Disk usage
- Uptime monitoring
- SSL certificate renewal

---

**Pronto!** Sua aplicação WhatsFlow estará rodando de forma estável e econômica no Easypanel.`,
    icon: Container,
    category: 'deployment'
  },
  {
    name: 'webhook_test_guide.md',
    title: 'Guia de Teste de Webhooks',
    description: 'Como testar e configurar webhooks do WooCommerce',
    content: `# Guia de Teste de Webhooks - WhatsFlow

## Configuração WooCommerce

### 1. Configurar Webhook no WooCommerce
- Ir em **WooCommerce > Configurações > Avançado > Webhooks**
- Clicar em **Adicionar webhook**
- **Nome**: WhatsFlow Order Update
- **Status**: Ativo
- **Tópico**: Order updated
- **URL de entrega**: \`https://seudominio.com/api/webhooks/woocommerce\`
- **Segredo**: (deixar em branco ou usar um segredo forte)

### 2. Eventos Suportados
- order.created
- order.updated
- order.deleted
- order.payment_complete
- order.on_hold
- order.processing
- order.completed
- order.cancelled
- order.refunded
- order.failed
- order.pending

## Teste Manual

### 1. Criar Pedido de Teste
\`\`\`bash
curl -X POST https://seudominio.com/api/webhooks/woocommerce \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": 12345,
    "status": "processing",
    "billing": {
      "first_name": "João",
      "last_name": "Silva",
      "phone": "5511999999999"
    },
    "line_items": [
      {
        "name": "Produto Teste",
        "quantity": 1,
        "price": 29.90
      }
    ],
    "total": "29.90",
    "currency": "BRL"
  }'
\`\`\`

### 2. Verificar Logs
- Acessar painel admin
- Ir em **Logs de Webhook**
- Verificar se o webhook foi recebido

## Troubleshooting

### Webhook não recebido
1. Verificar URL no WooCommerce
2. Testar conectividade: curl https://seudominio.com/api/health
3. Verificar logs do servidor: pm2 logs whatsflow

### Mensagem não enviada
1. Verificar configuração Evolution API
2. Testar conexão: **Admin > API Configuration > Testar Conexão**
3. Verificar template de mensagem configurado

### Número inválido
- Formato esperado: +5511999999999
- Verificar campo billing.phone no webhook`,
    icon: Settings,
    category: 'guide'
  }
];

export default function Documentation() {
  const [selectedTab, setSelectedTab] = useState('vps-install-guide.md');
  const { toast } = useToast();

  const selectedDoc = documentationFiles.find(doc => doc.name === selectedTab);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Download iniciado!",
      description: `Arquivo ${filename} baixado com sucesso`,
    });
  };

  const openInNewTab = (content: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Documentação WhatsFlow</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
              pre { background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
              code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 4px; }
              h1, h2, h3 { color: #333; }
              h1 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
              h2 { margin-top: 2rem; }
            </style>
          </head>
          <body>
            <pre>${content}</pre>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Documentação
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Guias de instalação e configuração do WhatsFlow
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          {documentationFiles.length} guias
        </Badge>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 gap-1">
          {documentationFiles.map((doc) => {
            const Icon = doc.icon;
            return (
              <TabsTrigger 
                key={doc.name} 
                value={doc.name}
                className="flex items-center gap-2 px-4 py-2"
                data-testid={`tab-${doc.name}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{doc.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {documentationFiles.map((doc) => {
          const Icon = doc.icon;
          return (
            <TabsContent key={doc.name} value={doc.name} className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{doc.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {doc.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {doc.category}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(doc.content)}
                      data-testid={`button-copy-${doc.name}`}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(doc.name, doc.content)}
                      data-testid={`button-download-${doc.name}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openInNewTab(doc.content)}
                      data-testid={`button-open-${doc.name}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                      {doc.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}