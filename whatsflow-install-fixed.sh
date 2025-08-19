#!/bin/bash

# WhatsFlow - Script de Instalação CORRIGIDO
# Versão: 2.0 (19/08/2025)
# Correções: Variáveis de ambiente carregadas explicitamente

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'  
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detectar sistema operacional
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$(echo $ID | tr '[:upper:]' '[:lower:]')
        VERSION=$VERSION_ID
    else
        log_error "Sistema operacional não suportado"
        exit 1
    fi
    
    log_info "Sistema detectado: $OS $VERSION"
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências..."
    
    case $OS in
        ubuntu|debian)
            sudo apt update
            sudo apt install -y curl wget git build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx ufw
            # Node.js 18
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt install -y nodejs
            ;;
        centos|rhel|rocky|alma)
            sudo dnf update -y
            sudo dnf install -y curl wget git gcc gcc-c++ make postgresql postgresql-server postgresql-contrib nginx certbot python3-certbot-nginx firewalld
            # Node.js 18
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
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
        centos|rhel|rocky|alma)
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
    
    # Executar migrações com variáveis explícitas
    log_info "Executando migrações do banco..."
    sudo -u whatsflow env \
        NODE_ENV=production \
        DATABASE_URL="postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow" \
        npm run db:push
    
    # Criar .env correto
    sudo -u whatsflow tee .env > /dev/null << EOF
NODE_ENV=production
DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow
SESSION_SECRET=$SESSION_SECRET
STRIPE_SECRET_KEY=sk_test_
VITE_STRIPE_PUBLIC_KEY=pk_test_
STRIPE_BASIC_PRICE_ID=price_
STRIPE_PRO_PRICE_ID=price_
STRIPE_ENTERPRISE_PRICE_ID=price_
EVOLUTION_API_KEY=your_evolution_api_key
EVOLUTION_API_URL=your_evolution_api_url
EOF
    
    # Testar aplicação ANTES do PM2
    log_info "Testando aplicação..."
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # Testar com variáveis explícitas
    sudo -u whatsflow env \
        NODE_ENV=production \
        DATABASE_URL="postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow" \
        SESSION_SECRET="$SESSION_SECRET" \
        timeout 20s node dist/index.js &
    
    TEST_PID=$!
    sleep 15
    
    # Verificar se aplicação subiu
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        log_success "Aplicação testada com sucesso!"
        kill $TEST_PID 2>/dev/null || true
    else
        log_error "Aplicação falhou no teste"
        kill $TEST_PID 2>/dev/null || true
        sudo -u whatsflow env \
            NODE_ENV=production \
            DATABASE_URL="postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow" \
            SESSION_SECRET="$SESSION_SECRET" \
            node dist/index.js || true
        exit 1
    fi
    
    # Criar ecosystem.config.cjs com variáveis corretas
    sudo -u whatsflow tee ecosystem.config.cjs > /dev/null << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow',
      SESSION_SECRET: '$SESSION_SECRET',
      STRIPE_SECRET_KEY: 'sk_test_',
      VITE_STRIPE_PUBLIC_KEY: 'pk_test_',
      STRIPE_BASIC_PRICE_ID: 'price_',
      STRIPE_PRO_PRICE_ID: 'price_',
      STRIPE_ENTERPRISE_PRICE_ID: 'price_',
      EVOLUTION_API_KEY: 'your_evolution_api_key',
      EVOLUTION_API_URL: 'your_evolution_api_url'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10
  }]
};
EOF
    
    # Iniciar PM2
    sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true
    sudo -u whatsflow pm2 start ecosystem.config.cjs
    
    # Verificar PM2
    sleep 10
    if curl -s http://localhost:5000 >/dev/null 2>&1 && sudo -u whatsflow pm2 list | grep -q "whatsflow.*online"; then
        log_success "PM2 configurado e aplicação funcionando!"
        
        # Configurar startup
        sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u whatsflow --hp /home/whatsflow >/dev/null 2>&1 || true
        sudo -u whatsflow pm2 save
    else
        log_error "PM2 falhou"
        sudo -u whatsflow pm2 logs whatsflow --lines 20 --nostream
        exit 1
    fi
    
    log_success "Aplicação instalada e rodando na porta 5000"
}

# Configurar SSL/Domínio
setup_ssl() {
    log_info "Configuração de domínio e SSL"
    echo -n "Deseja configurar um domínio e SSL? (s/N): "
    read SETUP_DOMAIN
    
    if [[ "$SETUP_DOMAIN" =~ ^[Ss]$ ]]; then
        echo -n "Domínio (ex: mylist.center): "
        read DOMAIN
        if [[ -z "$DOMAIN" ]]; then
            log_warning "Domínio não informado, pulando SSL"
            return
        fi
        
        echo -n "Email para SSL: "
        read EMAIL
        if [[ -z "$EMAIL" ]]; then
            log_warning "Email não informado, pulando SSL"
            return
        fi
        
        # Configurar Nginx
        case $OS in
            ubuntu|debian)
                sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                sudo ln -sf /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
                sudo rm -f /etc/nginx/sites-enabled/default
                ;;
            centos|rhel|rocky|alma)
                sudo tee /etc/nginx/conf.d/whatsflow.conf > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                sudo rm -f /etc/nginx/conf.d/default.conf
                ;;
        esac
        
        # Testar e aplicar
        if sudo nginx -t; then
            sudo systemctl enable --now nginx
            sudo systemctl reload nginx
            log_success "Nginx configurado para $DOMAIN"
            
            # SSL
            if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect --non-interactive; then
                log_success "SSL configurado! Site: https://$DOMAIN"
            else
                log_warning "SSL falhou, mas HTTP funciona: http://$DOMAIN"
            fi
        else
            log_error "Erro na configuração do Nginx"
        fi
    else
        log_info "Aplicação rodando em: http://seu-ip:5000"
    fi
}

# Função principal
main() {
    echo "============================================"
    echo "WhatsFlow - Instalação Automática v2.0"
    echo "Correção: Variáveis de ambiente explícitas"
    echo "============================================"
    
    detect_os
    install_dependencies
    setup_database
    install_application
    setup_ssl
    
    echo "============================================"
    log_success "INSTALAÇÃO COMPLETA!"
    echo "Aplicação: http://localhost:5000"
    echo "Admin: admin / admin123"
    echo "Logs: sudo -u whatsflow pm2 logs whatsflow"
    echo "============================================"
}

# Executar apenas se script for chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi