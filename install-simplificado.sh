#!/bin/bash
# WhatsFlow - Script de Instalação Automatizada SIMPLIFICADO
set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
}

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Executando como root (não recomendado)..."
        ROOT_USER=true
    else
        ROOT_USER=false
        log_info "Executando como usuário: $(whoami)"
    fi
}

install_system_deps() {
    log_info "Instalando dependências do sistema..."
    case $OS in
        ubuntu|debian)
            if [[ $ROOT_USER == true ]]; then
                apt update && apt install -y curl wget git build-essential postgresql postgresql-contrib nodejs npm nginx
            else
                sudo apt update && sudo apt install -y curl wget git build-essential postgresql postgresql-contrib nodejs npm nginx
            fi
            ;;
    esac
    log_success "Dependências instaladas"
}

install_nodejs() {
    log_info "Verificando Node.js..."
    NODE_VERSION=$(node --version 2>/dev/null || echo "não instalado")
    if [[ $NODE_VERSION == "não instalado" ]] || [[ ${NODE_VERSION:1:2} -lt 16 ]]; then
        log_info "Instalando Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    if [[ $ROOT_USER == true ]]; then
        npm install -g pm2
    else
        sudo npm install -g pm2
    fi
    log_success "Node.js e PM2 instalados"
}

setup_postgresql() {
    log_info "Configurando PostgreSQL..."
    
    if [[ $ROOT_USER == true ]]; then
        systemctl start postgresql
        systemctl enable postgresql
    else
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    fi
    
    sleep 3
    log_info "Criando usuário e banco de dados..."
    
    echo "Digite uma senha forte para o usuário PostgreSQL 'whatsflow':"
    read -s DB_PASSWORD
    echo
    
    if [[ -z "$DB_PASSWORD" ]]; then
        log_error "Senha não pode ser vazia!"
        exit 1
    fi
    
    # Criar usuário e banco
    if [[ $ROOT_USER == true ]]; then
        su - postgres -c "psql -c \"CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';\""
        su - postgres -c "psql -c \"CREATE DATABASE whatsflow;\""
        su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;\""
        su - postgres -c "psql -c \"ALTER USER whatsflow CREATEDB;\""
    else
        sudo -u postgres psql -c "CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';"
        sudo -u postgres psql -c "CREATE DATABASE whatsflow;"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;"
        sudo -u postgres psql -c "ALTER USER whatsflow CREATEDB;"
    fi
    
    log_success "PostgreSQL configurado"
}

setup_application() {
    log_info "Configurando aplicação WhatsFlow..."
    
    REPO_URL="https://github.com/NilsonFarias/ZapStatus-para-Woocommerce"
    read -p "Branch (padrão: main): " BRANCH
    BRANCH=${BRANCH:-main}
    
    if [[ -d "ZapStatus-para-Woocommerce" ]]; then
        rm -rf ZapStatus-para-Woocommerce
    fi
    
    git clone -b $BRANCH $REPO_URL ZapStatus-para-Woocommerce
    cd ZapStatus-para-Woocommerce
    
    log_info "Instalando dependências..."
    npm ci
    
    log_info "Configurando .env..."
    if [[ ! -f .env ]]; then
        cp .env.example .env
        
        # Configurações essenciais
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
        SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
        
        log_success "Arquivo .env configurado com variáveis essenciais"
        log_info "As configurações de Stripe e Evolution API podem ser feitas pela interface admin após a instalação"
    fi
    
    log_info "Building aplicação..."
    npm run build
    
    log_info "Executando migrações..."
    npm run migrate
    
    log_success "Aplicação configurada"
}

setup_pm2() {
    log_info "Iniciando aplicação com PM2..."
    pm2 delete whatsflow 2>/dev/null || true
    pm2 start npm --name "whatsflow" -- start
    pm2 startup
    pm2 save
    log_success "Aplicação iniciada"
}

final_check() {
    log_info "Verificando instalação..."
    sleep 5
    
    if curl -f http://localhost:5000 >/dev/null 2>&1; then
        log_success "Aplicação está rodando!"
    else
        log_warning "Aplicação pode estar iniciando ainda..."
    fi
    
    echo
    log_success "=== INSTALAÇÃO CONCLUÍDA ==="
    echo
    log_info "Próximos passos:"
    echo "1. Acesse: http://seu-servidor:5000"
    echo "2. Faça login como admin"
    echo "3. Configure Stripe e Evolution API na interface"
    echo
    log_info "Comandos úteis:"
    echo "  pm2 status              - Status da aplicação"
    echo "  pm2 logs whatsflow      - Logs da aplicação"
    echo "  pm2 restart whatsflow   - Reiniciar aplicação"
}

main() {
    log_info "Iniciando instalação do WhatsFlow..."
    detect_system
    check_root
    
    case ${1:-"--help"} in
        --full)
            install_system_deps
            install_nodejs
            setup_postgresql
            setup_application
            setup_pm2
            final_check
            ;;
        --help)
            echo "Uso: $0 --full"
            ;;
        *)
            log_error "Use: $0 --full"
            exit 1
            ;;
    esac
}

main "$@"