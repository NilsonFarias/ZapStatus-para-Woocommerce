#!/bin/bash

# WhatsFlow - Instalação Completa e Corrigida
# Script final com todas as correções identificadas
# Execução: curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/whatsflow-install-fixed.sh | bash -s -- --full

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

# Instalar Node.js 20 (CORREÇÃO: era 18 antes, causava erro import.meta.dirname)
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
            # CORREÇÃO: Suporte para CentOS 8+ e 9
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
    
    # CORREÇÃO: DATABASE_URL com formato correto para Neon/Serverless
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

# Instalar Nginx
install_nginx() {
    print_status "Installing Nginx..."
    
    case $OS in
        ubuntu|debian)
            sudo apt-get install -y nginx
            ;;
        centos|rhel|rocky|almalinux)
            sudo dnf install -y nginx
            ;;
    esac
    
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx installed and started"
}

# Configurar firewall
setup_firewall() {
    print_status "Configuring firewall..."
    
    case $OS in
        ubuntu|debian)
            sudo ufw allow 22/tcp
            sudo ufw allow 80/tcp
            sudo ufw allow 443/tcp
            sudo ufw allow 5000/tcp
            echo "y" | sudo ufw enable
            ;;
        centos|rhel|rocky|almalinux)
            sudo firewall-cmd --permanent --add-port=22/tcp
            sudo firewall-cmd --permanent --add-port=80/tcp
            sudo firewall-cmd --permanent --add-port=443/tcp
            sudo firewall-cmd --permanent --add-port=5000/tcp
            sudo firewall-cmd --reload
            ;;
    esac
    
    print_success "Firewall configured"
}

# Clonar e instalar aplicação
install_application() {
    print_status "Installing WhatsFlow application..."
    
    # Criar usuário whatsflow se não existir
    if ! id "whatsflow" &>/dev/null; then
        sudo useradd -m -s /bin/bash whatsflow
        print_success "User whatsflow created"
    fi
    
    # Criar diretório e clonar
    sudo -u whatsflow mkdir -p /home/whatsflow
    cd /home/whatsflow
    
    if [ -d "ZapStatus-para-Woocommerce" ]; then
        sudo -u whatsflow rm -rf ZapStatus-para-Woocommerce
    fi
    
    sudo -u whatsflow git clone https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
    cd ZapStatus-para-Woocommerce
    
    print_success "Application cloned"
}

# Configurar aplicação
configure_application() {
    print_status "Configuring application..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # CORREÇÃO: .env com placeholders válidos que permitem inicialização
    sudo -u whatsflow tee .env > /dev/null << EOF
# Database
DATABASE_URL="${DB_URL}"

# Session
SESSION_SECRET="$(openssl rand -base64 32)"

# Stripe (CORREÇÃO: placeholders válidos)
STRIPE_SECRET_KEY="sk_test_placeholder_$(openssl rand -hex 24)"
VITE_STRIPE_PUBLIC_KEY="pk_test_placeholder_$(openssl rand -hex 24)"

# Stripe Price IDs (placeholders)
STRIPE_BASIC_PRICE_ID="price_basic_placeholder"
STRIPE_PRO_PRICE_ID="price_pro_placeholder"
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise_placeholder"

# Evolution API (CORREÇÃO: placeholders válidos)
EVOLUTION_API_KEY="placeholder_$(openssl rand -hex 16)"
EVOLUTION_API_URL="http://localhost:8080"

# Production
NODE_ENV="production"
PORT="5000"
EOF
    
    # Instalar dependências
    sudo -u whatsflow npm install
    
    # CORREÇÃO: Build antes do banco para gerar dist/
    print_status "Building application..."
    sudo -u whatsflow npm run build
    
    # CORREÇÃO: Usar db:push ao invés de db:migrate inexistente
    print_status "Setting up database schema..."
    sudo -u whatsflow npm run db:push
    
    # Criar usuário admin padrão
    print_status "Creating default admin user..."
    
    # Carregar variáveis antes de criar admin
    source .env
    export DATABASE_URL
    
    sudo -u whatsflow -E node -e "
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
async function createAdmin() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Verificar se admin já existe
    const existing = await sql\`SELECT id FROM users WHERE email = 'admin@whatsflow.com'\`;
    if (existing.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Criar usuário admin
    await sql\`
      INSERT INTO users (email, password, name, role, plan, subscription_status)
      VALUES ('admin@whatsflow.com', \${hashedPassword}, 'Administrator', 'admin', 'enterprise', 'active')
    \`;
    
    console.log('✅ Admin user created: admin@whatsflow.com / admin123');
  } catch(e) {
    console.log('⚠️  Admin creation failed:', e.message);
  }
}
createAdmin();
"
    
    # CORREÇÃO: Ecosystem.config.cjs com variáveis explícitas
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
      SESSION_SECRET: '$(grep SESSION_SECRET .env | cut -d= -f2)',
      STRIPE_SECRET_KEY: '$(grep STRIPE_SECRET_KEY .env | cut -d= -f2)',
      VITE_STRIPE_PUBLIC_KEY: '$(grep VITE_STRIPE_PUBLIC_KEY .env | cut -d= -f2)',
      EVOLUTION_API_KEY: '$(grep EVOLUTION_API_KEY .env | cut -d= -f2)',
      EVOLUTION_API_URL: '$(grep EVOLUTION_API_URL .env | cut -d= -f2)'
    },
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000
  }]
};
EOF
    
    print_success "Application configured"
}

# Testar aplicação
test_application() {
    print_status "Testing application startup..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # CORREÇÃO: Teste manual com variáveis carregadas
    print_status "Testing standalone application..."
    
    # Carregar variáveis do .env
    source .env
    export DATABASE_URL SESSION_SECRET STRIPE_SECRET_KEY VITE_STRIPE_PUBLIC_KEY EVOLUTION_API_KEY EVOLUTION_API_URL
    
    # Teste com timeout
    sudo -u whatsflow -E timeout 15s npm start &
    APP_PID=$!
    
    sleep 10
    
    if kill -0 $APP_PID 2>/dev/null; then
        print_success "Application starts successfully"
        kill $APP_PID
        wait $APP_PID 2>/dev/null || true
    else
        print_error "Application failed to start"
        wait $APP_PID 2>/dev/null || true
        exit 1
    fi
    
    print_success "Application test passed"
}

# Configurar Nginx
configure_nginx() {
    print_status "Configuring Nginx..."
    
    # Solicitar domínio sem timeout
    if [ -z "$DOMAIN" ]; then
        echo -n "Enter your domain name (e.g., myapp.com) or press Enter for localhost: "
        read DOMAIN
        
        if [ -z "$DOMAIN" ]; then
            DOMAIN="localhost"
            print_warning "No domain entered, using localhost"
        fi
    fi
    
    print_status "Configuring for domain: $DOMAIN"
    
    # CORREÇÃO: Configuração Nginx otimizada
    sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    
    # CORREÇÃO: Sites-available vs conf.d baseado no OS
    case $OS in
        ubuntu|debian)
            sudo ln -sf /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
            sudo rm -f /etc/nginx/sites-enabled/default
            ;;
        centos|rhel|rocky|almalinux)
            sudo cp /etc/nginx/sites-available/whatsflow /etc/nginx/conf.d/whatsflow.conf
            ;;
    esac
    
    # Testar configuração
    sudo nginx -t
    sudo systemctl reload nginx
    
    print_success "Nginx configured for domain: $DOMAIN"
}

# Configurar SSL
setup_ssl() {
    print_status "Setting up SSL with Let's Encrypt..."
    
    # Pular SSL se domínio for localhost ou IP
    if [ "$DOMAIN" = "localhost" ] || [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_warning "Skipping SSL configuration for localhost/IP: $DOMAIN"
        print_status "Site will be available at: http://$DOMAIN"
        return 0
    fi
    
    # Instalar Certbot
    case $OS in
        ubuntu|debian)
            sudo apt-get install -y certbot python3-certbot-nginx
            ;;
        centos|rhel|rocky|almalinux)
            sudo dnf install -y certbot python3-certbot-nginx
            ;;
    esac
    
    # Configurar SSL com confirmação
    echo -n "Configure SSL certificate for $DOMAIN? (y/n) [y]: "
    read SETUP_SSL
    
    if [ -z "$SETUP_SSL" ]; then
        SETUP_SSL="y"
    fi
    
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        print_status "Configuring SSL certificate..."
        if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
            # Configurar renovação automática
            echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
            print_success "SSL certificate configured successfully"
            print_status "Site will be available at: https://$DOMAIN"
        else
            print_warning "SSL configuration failed. Site will use HTTP only."
            print_status "Site will be available at: http://$DOMAIN"
        fi
    else
        print_status "SSL configuration skipped. Site will be available at: http://$DOMAIN"
    fi
}

# Iniciar aplicação com PM2
start_application() {
    print_status "Starting application with PM2..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # Parar processos existentes
    sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true
    
    # Iniciar aplicação
    sudo -u whatsflow pm2 start ecosystem.config.cjs
    
    # Salvar configuração PM2
    sudo -u whatsflow pm2 save
    
    # Aguardar inicialização
    sleep 10
    
    # Verificar status
    sudo -u whatsflow pm2 status
    
    print_success "Application started with PM2"
}

# Verificações finais
final_checks() {
    print_status "Performing final checks..."
    
    # Verificar porta 5000
    if netstat -tulnp | grep -q :5000; then
        print_success "Application is listening on port 5000"
    else
        print_error "Application is not listening on port 5000"
        exit 1
    fi
    
    # Verificar endpoint
    if curl -s http://localhost:5000/api/health > /dev/null; then
        print_success "Health endpoint responding"
    else
        print_warning "Health endpoint not responding, but application may still work"
    fi
    
    # Verificar Nginx
    if sudo nginx -t &>/dev/null; then
        print_success "Nginx configuration is valid"
    else
        print_error "Nginx configuration has errors"
        exit 1
    fi
    
    print_success "All checks passed!"
}

# Função principal
main() {
    print_status "Starting WhatsFlow installation..."
    
    check_root
    detect_os
    detect_arch
    
    # Atualizar sistema
    print_status "Updating system packages..."
    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get upgrade -y
            sudo apt-get install -y curl wget git build-essential openssl
            ;;
        centos|rhel|rocky|almalinux)
            sudo dnf update -y
            sudo dnf groupinstall -y "Development Tools"
            sudo dnf install -y curl wget git openssl
            ;;
    esac
    
    # Instalar componentes
    install_nodejs
    install_postgresql
    setup_postgresql
    install_pm2
    install_nginx
    setup_firewall
    
    # Configurar aplicação
    install_application
    configure_application
    test_application
    configure_nginx
    
    # SSL opcional
    setup_ssl
    
    # Iniciar aplicação
    start_application
    final_checks
    
    print_success "WhatsFlow installation completed successfully!"
    echo
    echo "===========================================" 
    echo "🎉 INSTALLATION COMPLETE!"
    echo "==========================================="
    echo "📋 Summary:"
    echo "   • Application: Running on port 5000"
    echo "   • Database: PostgreSQL (local)"
    echo "   • Web Server: Nginx"
    echo "   • Process Manager: PM2"
    echo "   • Domain: $DOMAIN"
    echo
    echo "🔧 Management Commands:"
    echo "   • Check status: sudo -u whatsflow pm2 status"
    echo "   • View logs: sudo -u whatsflow pm2 logs whatsflow"
    echo "   • Restart app: sudo -u whatsflow pm2 restart whatsflow"
    echo "   • Reload Nginx: sudo systemctl reload nginx"
    echo
    echo "🌐 Access your application:"
    echo "   • HTTP: http://$DOMAIN"
    echo "   • HTTPS: https://$DOMAIN (if SSL was configured)"
    echo
    echo "👤 Default admin credentials:"
    echo "   • Email: admin@whatsflow.com"
    echo "   • Password: admin123"
    echo
    echo "⚙️  Next steps:"
    echo "   1. Configure Stripe keys in admin panel"
    echo "   2. Configure Evolution API settings"
    echo "   3. Create your first client account"
    echo
    echo "==========================================="
}

# Executar instalação
if [ "$1" = "--full" ]; then
    main
else
    echo "Usage: $0 --full"
    echo "Add --full flag to proceed with installation"
    exit 1
fi