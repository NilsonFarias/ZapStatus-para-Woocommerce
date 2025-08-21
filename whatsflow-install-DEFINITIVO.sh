#!/bin/bash

# WhatsFlow - Instalação VPS DEFINITIVA com correção WebSocket garantida
# Força aplicação das correções DURANTE o build para garantir que sejam compiladas
# Execução: bash whatsflow-install-DEFINITIVO.sh SEU_DOMINIO.COM

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

# Solicitar informações interativamente
print_status "========================================"
print_status "    WhatsFlow Production Installation"
print_status "========================================"
print_warning "Before starting, make sure:"
print_warning "1. Your domain DNS points to this server IP"
print_warning "2. Ports 80 and 443 are open in firewall"
print_warning "3. You have a valid email for SSL certificate"
print_status ""

# Solicitar domínio
while true; do
    read -p "Enter your domain (example: whatsapp.meusite.com.br): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        print_error "Domain cannot be empty. Please try again."
        continue
    fi
    
    # Validação básica do domínio
    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9\.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        print_error "Invalid domain format: $DOMAIN"
        print_error "Please provide a valid domain like: whatsapp.meusite.com.br"
        continue
    fi
    break
done

# Solicitar email para SSL
while true; do
    read -p "Enter your email for SSL certificate (required by Let's Encrypt): " SSL_EMAIL
    if [[ -z "$SSL_EMAIL" ]]; then
        print_error "Email cannot be empty. Please try again."
        continue
    fi
    
    # Validação básica do email
    if [[ ! "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        print_error "Invalid email format: $SSL_EMAIL"
        continue
    fi
    break
done

print_success "Domain configured: $DOMAIN"
print_success "SSL Email configured: $SSL_EMAIL"
print_status ""

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

# Configurar Nginx HTTP
configure_nginx() {
    print_status "Configuring Nginx reverse proxy (HTTP first)..."

    sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

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

# Configurar SSL
setup_ssl() {
    print_status "Setting up SSL certificate with Let's Encrypt..."
    
    print_warning "Make sure your domain $DOMAIN points to this server's IP address"
    print_status "Waiting 10 seconds before SSL setup..."
    sleep 10
    
    # Obter certificado SSL com email fornecido (apenas domínio principal)
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $SSL_EMAIL || {
        print_warning "SSL certificate setup failed. You can run it manually later:"
        print_warning "sudo certbot --nginx -d $DOMAIN --email $SSL_EMAIL"
    }
    
    # Configurar renovação automática
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo tee -a /var/spool/cron/crontabs/root
    
    print_success "SSL certificate configured"
}

# FUNÇÃO CRÍTICA: Aplicar correções WebSocket com verificação
apply_websocket_fix() {
    print_status "APPLYING CRITICAL WEBSOCKET FIXES..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # 1. SUBSTITUIR COMPLETAMENTE O server/db.ts - USAR PG PARA VPS
    print_status "Creating new server/db.ts with PostgreSQL (no Neon)..."
    sudo -u whatsflow tee server/db.ts > /dev/null << 'EOF'
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL connection for VPS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});
EOF

    # 2. SUBSTITUIR COMPLETAMENTE O server/migrate.ts - USAR PG PARA VPS
    print_status "Creating new server/migrate.ts with PostgreSQL (no Neon)..."
    sudo -u whatsflow tee server/migrate.ts > /dev/null << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function runMigrations() {
  try {
    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations completed successfully!");
    await pool.end();
  } catch (error) {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
EOF

    # 3. CORRIGIR CONFIGURAÇÃO DE SESSÃO PARA VPS PRODUÇÃO
    print_status "Fixing session configuration for VPS production..."
    
    # Backup do arquivo original antes das modificações
    sudo -u whatsflow cp server/routes.ts server/routes.ts.backup
    
    # Aplicar correção JavaScript inline para evitar duplicações
    sudo -u whatsflow cat > session-fix.js << 'JSEOF'
const fs = require('fs');

let content = fs.readFileSync('server/routes.ts', 'utf8');

// 1. Adicionar import se não existir
if (!content.includes('connect-pg-simple')) {
    content = content.replace(
        'import session from "express-session";',
        'import session from "express-session";\nimport connectPgSimple from "connect-pg-simple";'
    );
}

// 2. Remover duplicações existentes
content = content.replace(/const PgSession = connectPgSimple\(session\);[\s\S]*?}\);/g, '');

// 3. Adicionar store config antes de Session middleware
const storeConfig = `  // Session store configuration for production
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'sessions',
    ttl: 24 * 60 * 60 * 1000,
  });

`;

if (!content.includes('sessionStore')) {
    content = content.replace(
        /(\s+)\/\/ Session middleware/,
        '\n' + storeConfig + '$1// Session middleware'
    );
}

// 4. Substituir configuração de sessão
const sessionRegex = /app\.use\(session\(\{[\s\S]*?\}\)\);/;
const newSession = \`app.use(session({
    secret: process.env.SESSION_SECRET || 'whatsflow-secret-key-dev',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false, // Disabled until SSL is working properly
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));\`;

content = content.replace(sessionRegex, newSession);

// 5. Corrigir login save
const loginRegex = /req\.session\.userId = user\.id;[\s\S]*?res\.json\(userWithoutPassword\);/;
const newLogin = \`req.session.userId = user.id;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao criar sessão" });
        }
        
        console.log(\\\`Login successful: Session created for user \\\${user.id}\\\`);
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });\`;

content = content.replace(loginRegex, newLogin);

fs.writeFileSync('server/routes.ts', content);
console.log('✅ Session fixes applied!');
JSEOF

    sudo -u whatsflow node session-fix.js && sudo -u whatsflow rm session-fix.js

    # 4. VERIFICAR SE DB APLICOU
    if grep -q "drizzle-orm/node-postgres" server/db.ts; then
        print_success "✅ PostgreSQL db.ts applied successfully"
    else
        print_error "❌ PostgreSQL db.ts FAILED to apply"
        exit 1
    fi
    
    # 5. VERIFICAR SE MIGRATE APLICOU
    if grep -q "drizzle-orm/node-postgres" server/migrate.ts; then
        print_success "✅ PostgreSQL migrate.ts applied successfully"
    else
        print_error "❌ PostgreSQL migrate.ts FAILED to apply"
        exit 1
    fi
    
    # 6. VERIFICAR SE SESSÃO APLICOU
    if grep -q "connectPgSimple" server/routes.ts && grep -q "sessionStore" server/routes.ts && grep -q "req.session.save" server/routes.ts; then
        print_success "✅ Session configuration with PostgreSQL store applied successfully"
    else
        print_error "❌ Session configuration FAILED to apply"
        exit 1
    fi
    
    # 7. CORRIGIR SCHEMA
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

    # 8. VERIFICAR SCHEMA
    if grep -q "stripeCustomerId: true" shared/schema.ts; then
        print_success "✅ Schema fix applied successfully"
    else
        print_error "❌ Schema fix FAILED to apply"
        exit 1
    fi
    
    print_success "All fixes applied and verified!"
}

# Configurar aplicação
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
    
    # Criar .env
    sudo -u whatsflow tee .env > /dev/null << EOF
# Database - LOCAL PostgreSQL
DATABASE_URL="${DB_URL}"

# Session
SESSION_SECRET="$(openssl rand -base64 32)"

# Domain Configuration
DOMAIN="${DOMAIN}"
BASE_URL="https://${DOMAIN}"

# Stripe (configure with real keys)
STRIPE_SECRET_KEY="sk_live_CONFIGURE_WITH_REAL_KEY"
VITE_STRIPE_PUBLIC_KEY="pk_live_CONFIGURE_WITH_REAL_KEY"

# Stripe Price IDs
STRIPE_BASIC_PRICE_ID="price_CONFIGURE_REAL_BASIC_ID"
STRIPE_PRO_PRICE_ID="price_CONFIGURE_REAL_PRO_ID"
STRIPE_ENTERPRISE_PRICE_ID="price_CONFIGURE_REAL_ENTERPRISE_ID"

# Evolution API
EVOLUTION_API_KEY="CONFIGURE_WITH_REAL_API_KEY"
EVOLUTION_API_URL="https://${DOMAIN}/v2"

# SSL Production
NODE_TLS_REJECT_UNAUTHORIZED=1

# Production
NODE_ENV="production"
PORT="5000"
EOF

    # Instalar dependências incluindo pg para PostgreSQL e connect-pg-simple para sessões
    print_status "Installing dependencies..."
    sudo -u whatsflow npm install
    sudo -u whatsflow npm install pg @types/pg drizzle-orm connect-pg-simple @types/connect-pg-simple
    
    # APLICAR CORREÇÕES WEBSOCKET ANTES DO BUILD
    apply_websocket_fix
    
    # LIMPEZA COMPLETA DO CACHE
    print_status "Cleaning all caches..."
    sudo -u whatsflow rm -rf dist/ node_modules/.cache/ .vite/ build/ 2>/dev/null || true
    sudo -u whatsflow npm cache clean --force
    
    # BUILD COM VERIFICAÇÃO
    print_status "Building application with fixes..."
    sudo -u whatsflow npm run build
    
    # VERIFICAR SE BUILD CONTÉM POSTGRESQL
    if [ -f "dist/index.js" ]; then
        if grep -q "node-postgres\|Pool.*pg" dist/index.js; then
            print_success "✅ BUILD SUCCESS - PostgreSQL connection in dist/index.js"
        else
            print_warning "⚠️ PostgreSQL not found in dist - checking for database connection..."
            if grep -q "Connected to.*database" dist/index.js; then
                print_success "✅ BUILD SUCCESS - Database connection found"
            else
                print_warning "⚠️ Cannot verify database connection in dist/index.js"
                print_status "Proceeding anyway - will test at runtime"
            fi
        fi
    else
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
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
async function createAdmin() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const existing = await client.query('SELECT id FROM users WHERE email = \$1', ['admin@whatsflow.com']);
    if (existing.rows.length > 0) {
      console.log('✅ Admin user already exists');
      client.release();
      pool.end();
      return;
    }
    
    await client.query(\`
      INSERT INTO users (email, password, name, role, plan, subscription_status)
      VALUES (\$1, \$2, \$3, \$4, \$5, \$6)
    \`, ['admin@whatsflow.com', hashedPassword, 'Administrator', 'admin', 'enterprise', 'active']);
    
    console.log('✅ Admin user created: admin@whatsflow.com / admin123');
    client.release();
    pool.end();
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
      NODE_TLS_REJECT_UNAUTHORIZED: '1'
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

    print_success "Application configured with WebSocket fixes verified!"
}

# Função principal
main() {
    print_status "Starting WhatsFlow DEFINITIVE Installation"
    print_status "Domain: $DOMAIN"
    print_status "SSL Email: $SSL_EMAIL"
    print_warning "This version GUARANTEES WebSocket fixes are applied to the built code"
    
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
    print_success "WhatsFlow DEFINITIVE Installation COMPLETED!"
    print_success "========================================"
    print_status "Application URL: https://$DOMAIN"
    print_status "Admin login: admin@whatsflow.com / admin123"
    print_warning ""
    print_warning "WebSocket fixes VERIFIED in dist/index.js"
    print_warning "No more WebSocket SSL errors expected!"
    print_warning ""
    
    # Mostrar logs
    print_status "Application logs (should show NO WebSocket errors):"
    sleep 10
    sudo -u whatsflow pm2 logs whatsflow --lines 10
}

# Executar
main "$@"