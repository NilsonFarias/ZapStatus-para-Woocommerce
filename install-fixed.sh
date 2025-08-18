#!/bin/bash

# WhatsFlow - Script de Instalação Corrigido
# Versão: 3.0
# Compatível com: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detectar sistema operacional
detect_system() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
        VERSION="$VERSION_ID"
    else
        log_error "Não foi possível detectar o sistema operacional"
        exit 1
    fi
    
    ARCH=$(uname -m)
    log_info "Sistema detectado: $OS $VERSION ($ARCH)"
}

# Criar usuário whatsflow se executando como root
setup_user() {
    if [[ $EUID -eq 0 ]]; then
        log_info "Executando como root - configurando usuário whatsflow..."
        
        # Criar usuário se não existir
        if ! id "whatsflow" &>/dev/null; then
            log_info "Criando usuário whatsflow..."
            
            case $OS in
                ubuntu|debian)
                    useradd -m -s /bin/bash whatsflow
                    usermod -aG sudo whatsflow
                    ;;
                centos|rhel|rocky|alma)
                    useradd -m -s /bin/bash whatsflow  
                    usermod -aG wheel whatsflow
                    ;;
            esac
            
            log_success "Usuário whatsflow criado!"
        fi
        
        # Configurar sudo sem senha para instalação
        echo "whatsflow ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/whatsflow-install
        
        log_info "Continuando instalação como whatsflow..."
        exec sudo -u whatsflow -i bash "$0" "$@"
    else
        log_info "Executando como $(whoami)"
        
        # Verificar sudo
        if ! sudo -n true 2>/dev/null; then
            log_error "Usuário não tem privilégios sudo"
            exit 1
        fi
    fi
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências do sistema..."
    
    case $OS in
        ubuntu|debian)
            sudo apt update
            sudo apt install -y curl wget git build-essential \
                postgresql postgresql-contrib nginx certbot python3-certbot-nginx \
                software-properties-common
            ;;
        centos|rhel|rocky|alma)
            sudo dnf update -y
            sudo dnf install -y curl wget git gcc gcc-c++ make \
                postgresql postgresql-server postgresql-contrib \
                nginx certbot python3-certbot-nginx
            ;;
    esac
}

# Instalar Node.js
install_nodejs() {
    log_info "Instalando Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2
    log_success "Node.js $(node --version) instalado"
}

# Configurar PostgreSQL
setup_postgresql() {
    log_info "Configurando PostgreSQL..."
    
    # Inicializar se necessário
    case $OS in
        centos|rhel|rocky|alma)
            sudo postgresql-setup --initdb || true
            ;;
    esac
    
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Criar banco
    echo
    echo -n "Senha para banco PostgreSQL 'whatsflow': "
    read -s DB_PASSWORD
    echo
    
    sudo -u postgres psql << EOF
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
    log_info "Instalando WhatsFlow..."
    
    # Configurar repositório
    REPO_URL="https://github.com/NilsonFarias/ZapStatus-para-Woocommerce"
    echo -n "Branch (padrão: main): "
    read BRANCH
    BRANCH=${BRANCH:-main}
    
    # Clonar
    rm -rf ZapStatus-para-Woocommerce
    git clone -b $BRANCH $REPO_URL ZapStatus-para-Woocommerce
    cd ZapStatus-para-Woocommerce
    
    # Instalar dependências
    npm ci
    
    # Configurar .env
    if [[ ! -f .env ]]; then
        cp .env.example .env
        
        # Configurar DATABASE_URL
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
        
        # Gerar SESSION_SECRET
        SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
    fi
    
    # Build
    npm run build
    
    # Configurar PM2
    pm2 delete whatsflow 2>/dev/null || true
    pm2 start npm --name "whatsflow" -- start
    
    # Configurar startup automático
    STARTUP_CMD=$(pm2 startup systemd -u whatsflow --hp /home/whatsflow 2>&1 | grep "sudo env" | head -1)
    if [[ -n "$STARTUP_CMD" ]]; then
        log_info "Configurando auto-start do PM2..."
        eval "$STARTUP_CMD"
        pm2 save
        log_success "Auto-start configurado"
    fi
    
    log_success "Aplicação instalada e iniciada"
}

# Configurar Nginx e SSL
setup_nginx() {
    log_info "Configurando Nginx e SSL..."
    
    # Solicitar domínio
    echo
    echo -n "Domínio da aplicação (ex: whatsflow.com): "
    read DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        log_warning "Domínio não informado, pulando configuração Nginx/SSL"
        return
    fi
    
    # Solicitar email para Let's Encrypt
    echo -n "Email para certificados SSL: "
    read EMAIL
    if [[ -z "$EMAIL" ]]; then
        log_warning "Email não informado, pulando configuração SSL"
        return
    fi
    
    # Criar configuração Nginx
    sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
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
        proxy_connect_timeout 605;
        proxy_send_timeout 605;
        proxy_read_timeout 605;
        send_timeout 605;
        keepalive_timeout 605;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    location /health {
        proxy_pass http://localhost:5000/api/health;
        access_log off;
        proxy_set_header Host \$host;
    }
}
EOF
    
    # Ativar site
    sudo ln -sf /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    if sudo nginx -t; then
        sudo systemctl reload nginx
        log_success "Nginx configurado"
        
        # Configurar SSL com Certbot
        log_info "Configurando certificado SSL..."
        if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect; then
            log_success "SSL configurado com sucesso!"
            log_info "Aplicação disponível em: https://$DOMAIN"
        else
            log_warning "Erro ao configurar SSL. Verifique DNS e tente novamente"
            log_info "Aplicação disponível em: http://$DOMAIN"
        fi
    else
        log_error "Erro na configuração do Nginx"
    fi
}

# Menu principal
show_menu() {
    echo "=== WhatsFlow - Instalação Simplificada ==="
    echo "1. Instalação completa"
    echo "2. Apenas dependências"
    echo "3. Apenas aplicação"
    echo "4. Configurar Nginx/SSL"
    echo "0. Sair"
    echo -n "Escolha uma opção: "
    read choice
    
    case $choice in
        1) full_install ;;
        2) install_dependencies && install_nodejs ;;
        3) setup_postgresql && install_application ;;
        4) setup_nginx ;;
        0) exit 0 ;;
        *) log_error "Opção inválida" && show_menu ;;
    esac
}

# Instalação completa
full_install() {
    install_dependencies
    install_nodejs
    setup_postgresql
    install_application
    setup_nginx
    
    # Limpar configuração temporária
    sudo rm -f /etc/sudoers.d/whatsflow-install
    
    # Configurar sudo permanente (com senha)
    echo "whatsflow ALL=(ALL:ALL) ALL" | sudo tee /etc/sudoers.d/whatsflow > /dev/null
    
    log_success "Instalação completa concluída!"
    log_info "Login: admin / admin123"
    log_info "Configure senha: passwd whatsflow"
}

# Função principal
main() {
    log_info "WhatsFlow - Instalação Simplificada"
    
    detect_system
    setup_user
    
    if [[ $1 == "--full" ]]; then
        full_install
    else
        show_menu
    fi
}

# Executar
main "$@"