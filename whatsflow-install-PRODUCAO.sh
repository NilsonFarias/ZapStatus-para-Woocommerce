#!/bin/bash

# WhatsFlow - Instalação VPS Produção com SSL + Proxy Reverso
# Versão para VPS público com domínio e certificado SSL
# Execução: bash whatsflow-install-PRODUCAO.sh SEU_DOMINIO.COM

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar argumentos
if [ $# -eq 0 ]; then
    print_error "Usage: bash whatsflow-install-PRODUCAO.sh YOUR_DOMAIN.COM"
    print_error "Example: bash whatsflow-install-PRODUCAO.sh whatsflow.exemplo.com"
    exit 1
fi

DOMAIN=$1
print_status "Domain configured: $DOMAIN"

# Verificar se está rodando como root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Do not run this script as root. Run as regular user with sudo privileges."
        exit 1
    fi
}

# Detectar OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi

    print_status "Detected OS: $OS $VERSION"
}

# Instalar Node.js 20
install_nodejs() {
    print_status "Installing Node.js 20..."
    sudo apt-get remove -y nodejs npm 2>/dev/null || true

    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac

    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_success "Node.js $NODE_VERSION installed"
    print_success "npm $NPM_VERSION installed"
}

# Instalar dependências do sistema
install_dependencies() {
    print_status "Installing system dependencies..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib nginx certbot python3-certbot-nginx git curl openssl
    
    # Iniciar serviços
    sudo systemctl start postgresql nginx
    sudo systemctl enable postgresql nginx
    
    print_success "System dependencies installed"
}

# Configurar PostgreSQL
setup_postgresql() {
    print_status "Configuring PostgreSQL database..."

    sudo -u postgres psql << EOF
CREATE USER whatsflow WITH PASSWORD 'whatsflow123';
CREATE DATABASE whatsflow_db OWNER whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow_db TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
EOF

    DB_URL="postgresql://whatsflow:whatsflow123@localhost:5432/whatsflow_db"
    print_success "PostgreSQL database configured"
}

# Instalar PM2
install_pm2() {
    print_status "Installing PM2..."
    sudo npm install -g pm2
    pm2 startup | grep "sudo" | bash || true
    print_success "PM2 installed"
}

# Configurar firewall
setup_firewall() {
    print_status "Configuring firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "y" | sudo ufw enable 2>/dev/null || true
    print_success "Firewall configured"
}

# Configurar Nginx com proxy reverso (HTTP primeiro)
configure_nginx() {
    print_status "Configuring Nginx reverse proxy (HTTP only first)..."

    sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Main application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Evolution API proxy
    location /v2/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Ativar site
    sudo ln -sf /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    sudo nginx -t
    sudo systemctl reload nginx
    
    print_success "Nginx configured (HTTP mode)"
}

# Configurar SSL com Let's Encrypt
setup_ssl() {
    print_status "Setting up SSL certificate with Let's Encrypt..."
    
    print_warning "Make sure your domain $DOMAIN points to this server's IP address"
    print_status "Waiting 5 seconds before SSL setup..."
    sleep 5
    
    # Obter certificado SSL
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
        print_warning "SSL certificate setup failed. You can run it manually later:"
        print_warning "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    }
    
    # Configurar renovação automática
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo tee -a /var/spool/cron/crontabs/root
    
    print_success "SSL certificate configured"
}

# Configurar aplicação WhatsFlow
configure_application() {
    print_status "Configuring WhatsFlow application..."
    
    # Criar usuário whatsflow
    if ! id "whatsflow" &>/dev/null; then
        sudo useradd -m -s /bin/bash whatsflow
        print_success "User whatsflow created"
    fi
    
    # Clonar aplicação
    sudo -u whatsflow mkdir -p /home/whatsflow
    cd /home/whatsflow
    
    if [ -d "ZapStatus-para-Woocommerce" ]; then
        sudo -u whatsflow rm -rf ZapStatus-para-Woocommerce
    fi
    
    sudo -u whatsflow git clone https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
    cd ZapStatus-para-Woocommerce
    
    # Criar .env de produção
    sudo -u whatsflow tee .env > /dev/null << EOF
# Database - LOCAL PostgreSQL
DATABASE_URL="${DB_URL}"

# Session
SESSION_SECRET="$(openssl rand -base64 32)"

# Domain Configuration - PRODUÇÃO
DOMAIN="${DOMAIN}"
BASE_URL="https://${DOMAIN}"

# Stripe (configure with real keys)
STRIPE_SECRET_KEY="sk_live_CONFIGURE_WITH_REAL_KEY"
VITE_STRIPE_PUBLIC_KEY="pk_live_CONFIGURE_WITH_REAL_KEY"

# Stripe Price IDs (configure with real IDs)
STRIPE_BASIC_PRICE_ID="price_CONFIGURE_REAL_BASIC_ID"
STRIPE_PRO_PRICE_ID="price_CONFIGURE_REAL_PRO_ID"
STRIPE_ENTERPRISE_PRICE_ID="price_CONFIGURE_REAL_ENTERPRISE_ID"

# Evolution API (configure with real credentials)
EVOLUTION_API_KEY="CONFIGURE_WITH_REAL_API_KEY"
EVOLUTION_API_URL="https://${DOMAIN}/v2"

# SSL Configuration - PRODUÇÃO
NODE_TLS_REJECT_UNAUTHORIZED=1

# WebSocket Configuration
NEON_DISABLE_WEBSOCKET=1
DATABASE_POOL_MAX=20

# Production
NODE_ENV="production"
PORT="5000"
EOF

    # Instalar dependências
    print_status "Installing dependencies..."
    sudo -u whatsflow npm install

    # Aplicar correções WebSocket
    print_status "Applying WebSocket SSL fix..."
    sudo -u whatsflow tee server/db.ts > /dev/null << 'EOF'
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// VPS FIX: Disable WebSocket for VPS deployment
neonConfig.useSecureWebSocket = false;
neonConfig.webSocketConstructor = undefined;

// Additional configurations
neonConfig.webSocketTimeoutMs = 0;
if (typeof neonConfig.webSocketConstructor !== 'undefined') {
  delete neonConfig.webSocketConstructor;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: parseInt(process.env.DATABASE_POOL_MAX || '20')
});
export const db = drizzle({ client: pool, schema });
EOF

    # Corrigir schema
    print_status "Fixing user schema..."
    sudo -u whatsflow sed -i '/export const insertUserSchema = createInsertSchema(users).omit({/,/});/c\
export const insertUserSchema = createInsertSchema(users).omit({\
  id: true,\
  createdAt: true,\
  updatedAt: true,\
  username: true,\
  stripeCustomerId: true,\
  stripeSubscriptionId: true,\
});' shared/schema.ts

    # Build aplicação
    print_status "Building application..."
    sudo -u whatsflow rm -rf dist/ node_modules/.cache/ 2>/dev/null || true
    sudo -u whatsflow npm run build

    # Verificar build
    if [ ! -f "dist/index.js" ]; then
        print_error "Build failed - dist/index.js not found"
        exit 1
    fi

    # Configurar database
    print_status "Setting up database schema..."
    sudo -u whatsflow npm run db:push

    # Criar admin
    print_status "Creating admin user..."
    source .env
    export DATABASE_URL
    
    sudo -u whatsflow -E node -e "
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
async function createAdmin() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const existing = await sql\`SELECT id FROM users WHERE email = 'admin@whatsflow.com'\`;
    if (existing.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    await sql\`
      INSERT INTO users (email, password, name, role, plan, subscription_status)
      VALUES ('admin@whatsflow.com', \${hashedPassword}, 'Administrator', 'admin', 'enterprise', 'active')
    \`;
    
    console.log('✅ Admin user created: admin@whatsflow.com / admin123');
  } catch(e) {
    console.log('⚠️ Admin creation failed:', e.message);
  }
}
createAdmin();
"

    # PM2 config
    print_status "Creating PM2 configuration..."
    sudo -u whatsflow tee ecosystem.config.cjs > /dev/null << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: '${DB_URL}',
      DOMAIN: '${DOMAIN}',
      BASE_URL: 'https://${DOMAIN}',
      NODE_TLS_REJECT_UNAUTHORIZED: '1',
      NEON_DISABLE_WEBSOCKET: '1',
      DATABASE_POOL_MAX: '20'
    },
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    error_file: '/home/whatsflow/.pm2/logs/whatsflow-error.log',
    out_file: '/home/whatsflow/.pm2/logs/whatsflow-out.log',
    log_file: '/home/whatsflow/.pm2/logs/whatsflow-combined.log'
  }]
};
EOF

    print_success "Application configured"
}

# Função principal
main() {
    print_status "Starting WhatsFlow Production Installation for domain: $DOMAIN"
    
    check_root
    detect_os
    install_nodejs
    install_dependencies
    setup_postgresql
    install_pm2
    setup_firewall
    configure_nginx
    setup_ssl
    configure_application
    
    # Iniciar aplicação
    print_status "Starting WhatsFlow application..."
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    sudo -u whatsflow pm2 start ecosystem.config.cjs
    
    # Status final
    print_success "========================================"
    print_success "WhatsFlow Production Installation COMPLETED!"
    print_success "========================================"
    print_status "Application URL: https://$DOMAIN"
    print_status "Admin login: admin@whatsflow.com / admin123"
    print_warning ""
    print_warning "IMPORTANT: Configure real Stripe keys in /home/whatsflow/ZapStatus-para-Woocommerce/.env"
    print_warning "IMPORTANT: Configure Evolution API credentials"
    print_warning ""
    
    # Mostrar logs
    print_status "Application logs:"
    sleep 5
    sudo -u whatsflow pm2 logs whatsflow --lines 5
}

# Executar
main "$@"