#!/bin/bash

# Script de Instalação Automática WhatsFlow
# Versão Node.js 20 - Corrigida para compatibilidade com import.meta.dirname
# Data: 19 de agosto de 2025

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCESSO]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Detectar sistema operacional
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case $ID in
            ubuntu|debian) OS="ubuntu" ;;
            centos|rhel|rocky|almalinux) OS="centos" ;;
            *) 
                log_error "Sistema operacional não suportado: $ID"
                exit 1
                ;;
        esac
    else
        log_error "Não foi possível detectar o sistema operacional"
        exit 1
    fi
    log_info "Sistema detectado: $OS"
}

# Verificar se é root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "Este script não deve ser executado como root"
        exit 1
    fi
    
    if ! sudo -n true 2>/dev/null; then
        log_error "Este script requer privilégios sudo"
        exit 1
    fi
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências..."
    
    case $OS in
        ubuntu)
            sudo apt update
            sudo apt install -y curl wget git build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx ufw
            # Node.js 20 (CORRIGIDO)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt install -y nodejs
            ;;
        centos)
            sudo dnf update -y
            sudo dnf install -y curl wget git gcc gcc-c++ make postgresql postgresql-server postgresql-contrib nginx certbot python3-certbot-nginx firewalld
            # Node.js 20 (CORRIGIDO)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs
            ;;
        *)
            log_error "Sistema operacional $OS não suportado"
            exit 1
            ;;
    esac
    
    sudo npm install -g pm2
    
    # Configurar firewall
    log_info "Configurando firewall..."
    if command -v ufw &> /dev/null; then
        sudo ufw --force enable
        sudo ufw allow 22,80,443,5000/tcp
    elif command -v firewall-cmd &> /dev/null; then
        sudo systemctl enable --now firewalld
        sudo firewall-cmd --permanent --add-port={22,80,443,5000}/tcp
        sudo firewall-cmd --reload
    fi
    
    log_success "Dependências instaladas"
}

# Configurar PostgreSQL
setup_database() {
    log_info "Configurando PostgreSQL..."
    
    # Inicializar PostgreSQL baseado no SO
    case $OS in
        centos)
            if ! sudo -u postgres test -d /var/lib/pgsql/data/base; then
                sudo /usr/pgsql-*/bin/postgresql-*-setup initdb 2>/dev/null || \
                sudo postgresql-setup initdb 2>/dev/null || \
                sudo -u postgres initdb -D /var/lib/pgsql/data
            fi
            ;;
    esac
    
    sudo systemctl enable --now postgresql
    sleep 3
    
    if ! sudo systemctl is-active --quiet postgresql; then
        log_error "Falha ao iniciar PostgreSQL"
        exit 1
    fi
    
    # Solicitar senha
    echo -n "Senha para usuário PostgreSQL 'whatsflow': "
    read -s DB_PASSWORD
    echo
    
    if [[ -z "$DB_PASSWORD" ]]; then
        log_error "Senha não pode ser vazia"
        exit 1
    fi
    
    # Configurar banco
    sudo -u postgres psql << EOF
DROP USER IF EXISTS whatsflow;
DROP DATABASE IF EXISTS whatsflow;
CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
EOF
    
    log_success "PostgreSQL configurado"
}

# Instalar aplicação
install_application() {
    log_info "Instalando aplicação..."
    
    # Criar usuário se não existir
    if ! id "whatsflow" &>/dev/null; then
        sudo useradd -m -s /bin/bash whatsflow
        sudo usermod -aG sudo whatsflow 2>/dev/null || true
    fi
    
    cd /home/whatsflow
    sudo rm -rf ZapStatus-para-Woocommerce
    
    # Branch padrão
    BRANCH="main"
    echo -n "Branch (padrão: main): "
    read USER_BRANCH
    if [[ -n "$USER_BRANCH" ]]; then
        BRANCH="$USER_BRANCH"
    fi
    
    # Clone
    sudo -u whatsflow git clone -b "$BRANCH" https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
    cd ZapStatus-para-Woocommerce
    sudo chown -R whatsflow:whatsflow .
    
    # Instalar dependências
    sudo -u whatsflow npm ci
    sudo -u whatsflow npm run build
    
    # Gerar SESSION_SECRET
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Criar .env
    sudo -u whatsflow tee .env > /dev/null << EOF
# Database
DATABASE_URL=postgresql://whatsflow:${DB_PASSWORD}@localhost:5432/whatsflow

# Session
SESSION_SECRET=${SESSION_SECRET}

# Stripe (configurável via interface)
STRIPE_SECRET_KEY=sk_test_placeholder_will_be_configured_via_admin_interface
VITE_STRIPE_PUBLIC_KEY=pk_test_placeholder_will_be_configured_via_admin_interface
STRIPE_BASIC_PRICE_ID=price_placeholder_basic
STRIPE_PRO_PRICE_ID=price_placeholder_pro
STRIPE_ENTERPRISE_PRICE_ID=price_placeholder_enterprise

# Evolution API (configurável via interface)
EVOLUTION_API_URL=https://api.evolution.com
EVOLUTION_API_KEY=placeholder_will_be_configured_via_admin_interface

# Ambiente
NODE_ENV=production
EOF

    # Executar migrações do banco
    log_info "Configurando banco de dados..."
    sudo -u whatsflow npm run db:push
    
    log_success "Aplicação instalada"
}

# Configurar PM2
setup_pm2() {
    log_info "Configurando PM2..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # Carregar variáveis do .env para criar o ecosystem.config.cjs
    source .env
    
    # Criar ecosystem.config.cjs com variáveis explícitas (CRÍTICO para Node.js ESM)
    sudo -u whatsflow tee ecosystem.config.cjs > /dev/null << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    max_restarts: 10,
    min_uptime: '5s',
    env: {
      NODE_ENV: '${NODE_ENV}',
      DATABASE_URL: '${DATABASE_URL}',
      SESSION_SECRET: '${SESSION_SECRET}',
      STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}',
      VITE_STRIPE_PUBLIC_KEY: '${VITE_STRIPE_PUBLIC_KEY}',
      STRIPE_BASIC_PRICE_ID: '${STRIPE_BASIC_PRICE_ID}',
      STRIPE_PRO_PRICE_ID: '${STRIPE_PRO_PRICE_ID}',
      STRIPE_ENTERPRISE_PRICE_ID: '${STRIPE_ENTERPRISE_PRICE_ID}',
      EVOLUTION_API_URL: '${EVOLUTION_API_URL}',
      EVOLUTION_API_KEY: '${EVOLUTION_API_KEY}',
      PORT: '5000'
    }
  }]
};
EOF
    
    # Testar aplicação manualmente ANTES de iniciar PM2
    log_info "Testando aplicação..."
    timeout 10s sudo -u whatsflow env \
        NODE_ENV="$NODE_ENV" \
        DATABASE_URL="$DATABASE_URL" \
        SESSION_SECRET="$SESSION_SECRET" \
        STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
        VITE_STRIPE_PUBLIC_KEY="$VITE_STRIPE_PUBLIC_KEY" \
        STRIPE_BASIC_PRICE_ID="$STRIPE_BASIC_PRICE_ID" \
        STRIPE_PRO_PRICE_ID="$STRIPE_PRO_PRICE_ID" \
        STRIPE_ENTERPRISE_PRICE_ID="$STRIPE_ENTERPRISE_PRICE_ID" \
        EVOLUTION_API_URL="$EVOLUTION_API_URL" \
        EVOLUTION_API_KEY="$EVOLUTION_API_KEY" \
        PORT="5000" \
        node dist/index.js &
    
    sleep 5
    
    if curl -f http://localhost:5000/api/health; then
        log_success "Aplicação responde corretamente"
        pkill -f "node dist/index.js" || true
    else
        log_error "Aplicação não responde na porta 5000"
        pkill -f "node dist/index.js" || true
        exit 1
    fi
    
    # Iniciar com PM2
    sudo -u whatsflow pm2 start ecosystem.config.cjs
    sudo -u whatsflow pm2 save
    sudo -u whatsflow pm2 startup | grep -E '^sudo' | bash || true
    
    log_success "PM2 configurado"
}

# Configurar Nginx
setup_nginx() {
    log_info "Configurando Nginx..."
    
    echo -n "Domínio (ex: seudominio.com): "
    read DOMAIN
    
    if [[ -z "$DOMAIN" ]]; then
        log_error "Domínio é obrigatório"
        exit 1
    fi
    
    # Determinar caminho de configuração baseado no SO
    case $OS in
        ubuntu)
            NGINX_CONF="/etc/nginx/sites-available/whatsflow"
            NGINX_ENABLED="/etc/nginx/sites-enabled/whatsflow"
            ;;
        centos)
            NGINX_CONF="/etc/nginx/conf.d/whatsflow.conf"
            NGINX_ENABLED=""
            ;;
    esac
    
    # Criar configuração Nginx
    sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    client_max_body_size 10M;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF
    
    # Habilitar site (apenas Ubuntu/Debian)
    if [[ "$OS" == "ubuntu" ]]; then
        sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
        sudo rm -f /etc/nginx/sites-enabled/default
    fi
    
    sudo nginx -t
    sudo systemctl enable --now nginx
    sudo systemctl reload nginx
    
    # Configurar SSL
    echo -n "Configurar SSL com Let's Encrypt? (y/n): "
    read SSL_CHOICE
    
    if [[ "$SSL_CHOICE" =~ ^[Yy] ]]; then
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || {
            log_warning "Falha ao configurar SSL automaticamente"
            log_info "Configure manualmente: sudo certbot --nginx -d $DOMAIN"
        }
    fi
    
    log_success "Nginx configurado para $DOMAIN"
}

# Verificar saúde do sistema
health_check() {
    log_info "Verificando saúde do sistema..."
    
    # PostgreSQL
    if sudo systemctl is-active --quiet postgresql; then
        log_success "✓ PostgreSQL: Ativo"
    else
        log_error "✗ PostgreSQL: Inativo"
        return 1
    fi
    
    # PM2
    if sudo -u whatsflow pm2 list | grep -q "whatsflow.*online"; then
        log_success "✓ PM2: Aplicação online"
    else
        log_error "✗ PM2: Aplicação offline"
        return 1
    fi
    
    # Nginx
    if sudo systemctl is-active --quiet nginx; then
        log_success "✓ Nginx: Ativo"
    else
        log_error "✗ Nginx: Inativo"
        return 1
    fi
    
    # Resposta HTTP
    if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        log_success "✓ Aplicação: Respondendo"
    else
        log_error "✗ Aplicação: Não responde"
        return 1
    fi
    
    log_success "Sistema healthy!"
    return 0
}

# Função principal
main() {
    log_info "=== WhatsFlow - Instalação Automática (Node.js 20) ==="
    log_info "Iniciando instalação..."
    
    check_root
    detect_os
    install_dependencies
    setup_database
    install_application
    setup_pm2
    setup_nginx
    
    if health_check; then
        log_success "=== INSTALAÇÃO CONCLUÍDA COM SUCESSO ==="
        log_info "Aplicação disponível em: http://$DOMAIN"
        log_info "Login padrão: admin / admin123"
        log_info "Configure API keys em: Configurações → API Configuration"
    else
        log_error "=== INSTALAÇÃO COM PROBLEMAS ==="
        log_info "Verifique os logs: sudo -u whatsflow pm2 logs whatsflow"
    fi
}

# Executar instalação
main "$@"