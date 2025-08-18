#!/bin/bash

# WhatsFlow - Script de Instalação Automatizada
# Compatível com Ubuntu 20.04+, Debian 11+, CentOS 8+
# Suporta arquiteturas x86_64 e ARM64

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detectar SO e arquitetura
detect_system() {
    log_info "Detectando sistema operacional..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Não foi possível detectar o sistema operacional"
        exit 1
    fi
    
    ARCH=$(uname -m)
    log_info "Sistema: $OS $VERSION ($ARCH)"
    
    # Verificar compatibilidade
    case $OS in
        ubuntu)
            if [[ $(echo "$VERSION >= 20.04" | bc -l) -eq 0 ]]; then
                log_error "Ubuntu 20.04+ é necessário"
                exit 1
            fi
            ;;
        debian)
            if [[ $(echo "$VERSION >= 11" | bc -l) -eq 0 ]]; then
                log_error "Debian 11+ é necessário"
                exit 1
            fi
            ;;
        centos|rhel)
            if [[ $(echo "$VERSION >= 8" | bc -l) -eq 0 ]]; then
                log_error "CentOS/RHEL 8+ é necessário"
                exit 1
            fi
            ;;
        *)
            log_warning "Sistema não testado oficialmente: $OS"
            ;;
    esac
}

# Verificar se está executando como root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Executando como root."
        echo
        read -p "Deseja criar usuário 'whatsflow' e continuar instalação com ele? (y/n): " CREATE_USER
        
        if [[ $CREATE_USER =~ ^[Yy]$ ]]; then
            # Criar usuário whatsflow
            if ! id "whatsflow" &>/dev/null; then
                log_info "Criando usuário 'whatsflow'..."
                
                # Usar adduser no Ubuntu/Debian, useradd no CentOS/RHEL
                case $OS in
                    ubuntu|debian)
                        adduser --disabled-password --gecos "" whatsflow
                        usermod -aG sudo whatsflow
                        # Definir senha
                        echo
                        log_info "Defina uma senha para o usuário 'whatsflow':"
                        passwd whatsflow
                        ;;
                    centos|rhel)
                        useradd -m -s /bin/bash whatsflow
                        usermod -aG wheel whatsflow
                        # Definir senha
                        echo
                        log_info "Defina uma senha para o usuário 'whatsflow':"
                        passwd whatsflow
                        ;;
                esac
                
                log_success "Usuário 'whatsflow' criado com sucesso!"
            else
                log_info "Usuário 'whatsflow' já existe."
            fi
            
            # Copiar script para o usuário
            cp "$0" /home/whatsflow/
            chown whatsflow:whatsflow /home/whatsflow/$(basename "$0")
            chmod +x /home/whatsflow/$(basename "$0")
            
            log_info "Execute agora como usuário whatsflow:"
            echo "su - whatsflow"
            echo "bash $(basename "$0")"
            exit 0
        else
            log_warning "Continuando com instalação como root (não recomendado)..."
            ROOT_USER=true
        fi
    else
        ROOT_USER=false
        log_info "Executando como usuário: $(whoami)"
    fi
}

# Instalar dependências do sistema
install_system_deps() {
    log_info "Atualizando sistema e instalando dependências..."
    
    case $OS in
        ubuntu|debian)
            if [[ $ROOT_USER == true ]]; then
                apt update
                apt install -y curl wget git build-essential software-properties-common \
                    postgresql postgresql-contrib nginx certbot python3-certbot-nginx \
                    ufw bc unzip
            else
                sudo apt update
                sudo apt install -y curl wget git build-essential software-properties-common \
                    postgresql postgresql-contrib nginx certbot python3-certbot-nginx \
                    ufw bc unzip
            fi
            ;;
        centos|rhel)
            if [[ $ROOT_USER == true ]]; then
                dnf update -y
                dnf install -y curl wget git gcc gcc-c++ make \
                    postgresql postgresql-server postgresql-contrib \
                    nginx certbot python3-certbot-nginx firewalld bc unzip
            else
                sudo dnf update -y
                sudo dnf install -y curl wget git gcc gcc-c++ make \
                    postgresql postgresql-server postgresql-contrib \
                    nginx certbot python3-certbot-nginx firewalld bc unzip
            fi
            ;;
    esac
    
    log_success "Dependências do sistema instaladas"
}

# Instalar Node.js
install_nodejs() {
    log_info "Instalando Node.js 18..."
    
    # Detectar arquitetura para download correto
    case $ARCH in
        x86_64)
            NODE_ARCH="x64"
            ;;
        aarch64|arm64)
            NODE_ARCH="arm64"
            ;;
        armv7l)
            NODE_ARCH="armv7l"
            ;;
        *)
            log_error "Arquitetura não suportada: $ARCH"
            exit 1
            ;;
    esac
    
    # Instalar via NodeSource
    if [[ $ROOT_USER == true ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    fi
    
    case $OS in
        ubuntu|debian)
            if [[ $ROOT_USER == true ]]; then
                apt-get install -y nodejs
            else
                sudo apt-get install -y nodejs
            fi
            ;;
        centos|rhel)
            if [[ $ROOT_USER == true ]]; then
                dnf install -y nodejs
            else
                sudo dnf install -y nodejs
            fi
            ;;
    esac
    
    # Verificar instalação
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_success "Node.js $NODE_VERSION e npm $NPM_VERSION instalados"
    
    # Instalar PM2 globalmente
    if [[ $ROOT_USER == true ]]; then
        npm install -g pm2
    else
        sudo npm install -g pm2
    fi
    log_success "PM2 instalado globalmente"
}

# Configurar PostgreSQL
setup_postgresql() {
    log_info "Configurando PostgreSQL..."
    
    case $OS in
        centos|rhel)
            if [[ $ROOT_USER == true ]]; then
                postgresql-setup --initdb
                systemctl enable postgresql
            else
                sudo postgresql-setup --initdb
                sudo systemctl enable postgresql
            fi
            ;;
    esac
    
    if [[ $ROOT_USER == true ]]; then
        systemctl start postgresql
        systemctl enable postgresql
    else
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    fi
    
    # Criar usuário e banco
    log_info "Criando usuário e banco de dados..."
    
    read -s -p "Digite uma senha forte para o usuário PostgreSQL 'whatsflow': " DB_PASSWORD
    echo
    
    if [[ $ROOT_USER == true ]]; then
        su - postgres -c "psql" << EOF
CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
EOF
    else
        sudo -u postgres psql << EOF
CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
EOF
    fi
    
    log_success "PostgreSQL configurado com sucesso"
}

# Baixar e configurar aplicação
setup_application() {
    log_info "Configurando aplicação WhatsFlow..."
    
    # Configurações do repositório
    REPO_URL="https://github.com/NilsonFarias/ZapStatus-para-Woocommerce"
    echo
    read -p "Branch (padrão: main): " BRANCH
    BRANCH=${BRANCH:-main}
    
    log_info "Usando repositório: $REPO_URL"
    
    # Clonar repositório
    if [[ -d "whatsflow" ]]; then
        log_warning "Diretório whatsflow já existe. Removendo..."
        rm -rf whatsflow
    fi
    
    git clone -b $BRANCH $REPO_URL ZapStatus-para-Woocommerce
    cd ZapStatus-para-Woocommerce
    
    # Instalar dependências
    log_info "Instalando dependências da aplicação..."
    npm ci
    
    # Configurar ambiente
    log_info "Configurando variáveis de ambiente..."
    
    if [[ ! -f .env ]]; then
        cp .env.example .env
        
        # Configurar DATABASE_URL
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
        
        # Gerar SESSION_SECRET
        SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
        
        echo
        log_success "Arquivo .env configurado com variáveis essenciais"
        log_info "Configurações de Stripe e Evolution API podem ser feitas pela interface admin"
    fi
    
    # Build da aplicação
    log_info "Fazendo build da aplicação..."
    npm run build
    
    log_success "Aplicação configurada com sucesso"
}

# Configurar PM2
setup_pm2() {
    log_info "Configurando PM2..."
    
    # Parar se já estiver rodando
    pm2 delete whatsflow 2>/dev/null || true
    
    # Iniciar aplicação
    pm2 start npm --name "whatsflow" -- start
    
    # Configurar auto-start
    pm2 startup
    pm2 save
    
    log_success "PM2 configurado e aplicação iniciada"
}

# Configurar Nginx
setup_nginx() {
    log_info "Configurando Nginx..."
    
    echo
    read -p "Domínio da aplicação (ex: whatsflow.com): " DOMAIN
    
    # Criar configuração do Nginx
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
    
    # Habilitar site
    sudo ln -sf /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    log_success "Nginx configurado para $DOMAIN"
}

# Configurar SSL
setup_ssl() {
    log_info "Configurando SSL com Let's Encrypt..."
    
    echo
    read -p "Configurar SSL automaticamente? (y/n): " SETUP_SSL
    
    if [[ $SETUP_SSL =~ ^[Yy]$ ]]; then
        sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        # Configurar renovação automática
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        log_success "SSL configurado com sucesso"
    else
        log_warning "SSL não configurado. Configure manualmente depois com:"
        echo "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
}

# Configurar firewall
setup_firewall() {
    log_info "Configurando firewall..."
    
    case $OS in
        ubuntu|debian)
            sudo ufw --force enable
            sudo ufw allow ssh
            sudo ufw allow 'Nginx Full'
            sudo ufw --force reload
            ;;
        centos|rhel)
            sudo systemctl enable firewalld
            sudo systemctl start firewalld
            sudo firewall-cmd --permanent --add-service=ssh
            sudo firewall-cmd --permanent --add-service=http
            sudo firewall-cmd --permanent --add-service=https
            sudo firewall-cmd --reload
            ;;
    esac
    
    log_success "Firewall configurado"
}

# Verificação final
final_check() {
    log_info "Verificando instalação..."
    
    # Testar aplicação
    sleep 5
    if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        log_success "Aplicação está rodando localmente"
    else
        log_error "Aplicação não está respondendo localmente"
        return 1
    fi
    
    # Verificar serviços
    if systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL está ativo"
    else
        log_error "PostgreSQL não está ativo"
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx está ativo"
    else
        log_error "Nginx não está ativo"
    fi
    
    if pm2 show whatsflow >/dev/null 2>&1; then
        log_success "PM2 está gerenciando a aplicação"
    else
        log_error "PM2 não está gerenciando a aplicação"
    fi
    
    echo
    log_success "=== INSTALAÇÃO CONCLUÍDA ==="
    echo
    log_info "Aplicação disponível em:"
    echo "  Local: http://localhost:5000"
    if [[ -n $DOMAIN ]]; then
        echo "  Público: http://$DOMAIN"
        if [[ $SETUP_SSL =~ ^[Yy]$ ]]; then
            echo "  HTTPS: https://$DOMAIN"
        fi
    fi
    echo
    log_info "Comandos úteis:"
    echo "  pm2 status              - Status da aplicação"
    echo "  pm2 logs whatsflow      - Logs da aplicação"
    echo "  pm2 restart whatsflow   - Reiniciar aplicação"
    echo "  sudo systemctl status nginx postgresql - Status dos serviços"
    echo
    log_warning "Não esqueça de configurar as variáveis do Stripe e Evolution API no arquivo .env"
}

# Menu principal
show_menu() {
    echo
    echo "=== WhatsFlow - Instalação Automatizada ==="
    echo
    echo "1) Instalação completa (recomendado)"
    echo "2) Apenas dependências do sistema"
    echo "3) Apenas aplicação"
    echo "4) Apenas configuração de servidor (Nginx/SSL)"
    echo "5) Verificar instalação"
    echo "0) Sair"
    echo
    read -p "Escolha uma opção: " OPTION
}

# Função principal
main() {
    log_info "Iniciando instalação do WhatsFlow..."
    
    check_root
    detect_system
    
    if [[ $# -eq 0 ]]; then
        show_menu
        
        case $OPTION in
            1)
                install_system_deps
                install_nodejs
                setup_postgresql
                setup_application
                setup_pm2
                setup_nginx
                setup_ssl
                setup_firewall
                final_check
                ;;
            2)
                install_system_deps
                install_nodejs
                log_success "Dependências instaladas"
                ;;
            3)
                setup_application
                setup_pm2
                log_success "Aplicação configurada"
                ;;
            4)
                setup_nginx
                setup_ssl
                setup_firewall
                log_success "Servidor configurado"
                ;;
            5)
                final_check
                ;;
            0)
                log_info "Saindo..."
                exit 0
                ;;
            *)
                log_error "Opção inválida"
                exit 1
                ;;
        esac
    else
        # Instalação completa via parâmetro
        case $1 in
            --full)
                install_system_deps
                install_nodejs
                setup_postgresql
                setup_application
                setup_pm2
                setup_nginx
                setup_ssl
                setup_firewall
                final_check
                ;;
            --help)
                echo "Uso: $0 [--full|--help]"
                echo "  --full: Instalação completa automatizada"
                echo "  --help: Mostra esta ajuda"
                ;;
            *)
                log_error "Parâmetro inválido. Use --help para ajuda"
                exit 1
                ;;
        esac
    fi
}

# Executar
main "$@"