#!/bin/bash

# WhatsFlow - Instalação VPS 100% Funcional
# Versão DEFINITIVA com correções WebSocket SSL integradas
# Execução: curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/whatsflow-install-NOVA-VERSAO.sh | bash

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Detectar arquitetura
detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="x64" ;;
        aarch64) ARCH="arm64" ;;
        armv7l) ARCH="armv7l" ;;
        *) print_error "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    print_status "Detected architecture: $ARCH"
}

# Verificar se está rodando como root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Do not run this script as root. Run as regular user with sudo privileges."
        exit 1
    fi
}

# Instalar Node.js 20
install_nodejs() {
    print_status "Installing Node.js 20..."

    # Remove instalações antigas
    sudo apt-get remove -y nodejs npm 2>/dev/null || true

    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        centos|rhel|rocky|almalinux)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs npm
            ;;
        *)
            print_error "Unsupported OS for Node.js installation"
            exit 1
            ;;
    esac

    # Verificar versão
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)

    print_success "Node.js $NODE_VERSION installed"
    print_success "npm $NPM_VERSION installed"
}

# Instalar PostgreSQL
install_postgresql() {
    print_status "Installing PostgreSQL..."

    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
            ;;
        centos|rhel|rocky|almalinux)
            if [ "$VERSION" -ge 8 ]; then
                sudo dnf install -y postgresql postgresql-server postgresql-contrib
                sudo postgresql-setup --initdb 2>/dev/null || sudo /usr/bin/postgresql-setup initdb
            else
                sudo yum install -y postgresql postgresql-server postgresql-contrib
                sudo service postgresql initdb
            fi
            ;;
    esac

    # Iniciar PostgreSQL
    sudo systemctl start postgresql
    sudo systemctl enable postgresql

    print_success "PostgreSQL installed and started"
}

# Configurar PostgreSQL
setup_postgresql() {
    print_status "Configuring PostgreSQL database..."

    # Criar usuário e banco
    sudo -u postgres psql << EOF
CREATE USER whatsflow WITH PASSWORD 'whatsflow123';
CREATE DATABASE whatsflow_db OWNER whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow_db TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
EOF

    DB_URL="postgresql://whatsflow:whatsflow123@localhost:5432/whatsflow_db"

    print_success "PostgreSQL database configured"
    print_status "Database URL: $DB_URL"
}

# Instalar PM2
install_pm2() {
    print_status "Installing PM2..."
    sudo npm install -g pm2

    # Configurar PM2 startup
    pm2 startup | grep "sudo" | bash || true

    print_success "PM2 installed"
}

# Configurar aplicação - VERSÃO CORRIGIDA
configure_application() {
    print_status "Configuring WhatsFlow application..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # 1. CRIAR .env PRIMEIRO
    sudo -u whatsflow tee .env > /dev/null << EOF
# Database - LOCAL PostgreSQL
DATABASE_URL="${DB_URL}"

# Session
SESSION_SECRET="$(openssl rand -base64 32)"

# Domain Configuration
DOMAIN="${DOMAIN:-localhost}"
BASE_URL="https://${DOMAIN:-localhost}"

# Stripe (placeholders válidos)
STRIPE_SECRET_KEY="sk_test_placeholder_$(openssl rand -hex 24)"
VITE_STRIPE_PUBLIC_KEY="pk_test_placeholder_$(openssl rand -hex 24)"

# Stripe Price IDs (placeholders)
STRIPE_BASIC_PRICE_ID="price_basic_placeholder"
STRIPE_PRO_PRICE_ID="price_pro_placeholder"
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise_placeholder"

# Evolution API
EVOLUTION_API_KEY="placeholder_$(openssl rand -hex 16)"
EVOLUTION_API_URL="https://${DOMAIN:-localhost}/v2"

# SSL Configuration
NODE_TLS_REJECT_UNAUTHORIZED=0

# WebSocket Configuration - CRÍTICO
NEON_DISABLE_WEBSOCKET=1
DATABASE_POOL_MAX=10

# Production
NODE_ENV="production"
PORT="5000"
EOF

    # 2. INSTALAR DEPENDÊNCIAS
    print_status "Installing dependencies..."
    sudo -u whatsflow npm install

    # 3. APLICAR CORREÇÕES ANTES DO BUILD
    print_status "Applying CRITICAL WebSocket SSL fix..."
    sudo -u whatsflow tee server/db.ts > /dev/null << 'EOF'
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// CRITICAL VPS FIX: Completely disable WebSocket to prevent SSL errors
neonConfig.useSecureWebSocket = false;
neonConfig.webSocketConstructor = undefined;

// Additional SSL bypass configurations for VPS
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
  max: parseInt(process.env.DATABASE_POOL_MAX || '10')
});
export const db = drizzle({ client: pool, schema });
EOF

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

    # 4. CLEAN BUILD - CRÍTICO
    print_status "Clean building application with fixes..."
    sudo -u whatsflow rm -rf dist/ node_modules/.cache/ .next/ 2>/dev/null || true
    sudo -u whatsflow npm run build

    # 5. VERIFICAR BUILD
    if [ ! -f "dist/index.js" ]; then
        print_error "Build failed - dist/index.js not found"
        exit 1
    fi
    
    # 6. CONFIGURAR DATABASE
    print_status "Setting up database schema..."
    sudo -u whatsflow npm run db:push

    # 7. CRIAR ADMIN
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

    # 8. PM2 CONFIG
    print_status "Creating PM2 configuration..."
    sudo -u whatsflow tee ecosystem.config.cjs > /dev/null << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: '${DB_URL}',
      DOMAIN: '${DOMAIN:-localhost}',
      BASE_URL: 'https://${DOMAIN:-localhost}',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      NEON_DISABLE_WEBSOCKET: '1',
      DATABASE_POOL_MAX: '10'
    },
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000
  }]
};
EOF

    print_success "Application configured successfully"
}

# Função principal
main() {
    print_status "Starting WhatsFlow VPS installation..."
    
    # Solicitar domínio
    if [ -z "$DOMAIN" ]; then
        echo "Enter your domain (or press Enter for localhost):"
        read DOMAIN
        if [ -z "$DOMAIN" ]; then
            DOMAIN="localhost"
        fi
    fi
    
    check_root
    detect_os  
    detect_arch
    
    # Criar usuário whatsflow
    if ! id "whatsflow" &>/dev/null; then
        sudo useradd -m -s /bin/bash whatsflow
    fi
    
    # Instalar dependências
    install_nodejs
    install_postgresql
    setup_postgresql
    install_pm2
    
    # Clonar aplicação
    sudo -u whatsflow mkdir -p /home/whatsflow
    cd /home/whatsflow
    
    if [ -d "ZapStatus-para-Woocommerce" ]; then
        sudo -u whatsflow rm -rf ZapStatus-para-Woocommerce
    fi
    
    sudo -u whatsflow git clone https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
    
    # Configurar aplicação
    configure_application
    
    # Iniciar PM2
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    sudo -u whatsflow pm2 start ecosystem.config.cjs
    
    print_success "WhatsFlow installation completed!"
    print_status "Application running on port 5000"
    print_status "Admin login: admin@whatsflow.com / admin123"
    
    # Mostrar logs
    sleep 5
    sudo -u whatsflow pm2 logs whatsflow --lines 10
}

# Executar
main "$@"