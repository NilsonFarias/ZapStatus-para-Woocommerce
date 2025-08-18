#!/bin/bash

# WhatsFlow - Script de Instalação Automatizada CORRIGIDO
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
                useradd -m -s /bin/bash whatsflow
                usermod -aG sudo whatsflow
                
                # Definir senha
                echo
                log_info "Defina uma senha para o usuário 'whatsflow':"
                passwd whatsflow
                
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
    
    # Detectar arquitetura
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
        su - postgres << EOF
psql -c "CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';"
psql -c "CREATE DATABASE whatsflow;"
psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;"
psql -c "ALTER USER whatsflow CREATEDB;"
EOF
    else
        sudo -u postgres << EOF
psql -c "CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';"
psql -c "CREATE DATABASE whatsflow;"
psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;"
psql -c "ALTER USER whatsflow CREATEDB;"
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
    if [[ -d "ZapStatus-para-Woocommerce" ]]; then
        log_warning "Diretório ZapStatus-para-Woocommerce já existe. Removendo..."
        rm -rf ZapStatus-para-Woocommerce
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
        log_warning "Configure as seguintes variáveis no arquivo .env:"
        echo "- STRIPE_SECRET_KEY"
        echo "- VITE_STRIPE_PUBLIC_KEY"
        echo "- STRIPE_*_PRICE_ID"
        echo "- EVOLUTION_API_KEY"
        echo "- EVOLUTION_API_URL"
        echo
        read -p "Pressione Enter quando terminar de configurar o .env..."
    fi
    
    # Build da aplicação
    log_info "Fazendo build da aplicação..."
    npm run build
    
    # Executar migrações
    log_info "Executando migrações do banco..."
    npm run migrate
    
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
    
    echo
    log_success "=== INSTALAÇÃO CONCLUÍDA ==="
    echo
    log_info "Aplicação disponível em:"
    echo "  Local: http://localhost:5000"
    echo
    log_info "Comandos úteis:"
    echo "  pm2 status              - Status da aplicação"
    echo "  pm2 logs whatsflow      - Logs da aplicação"
    echo "  pm2 restart whatsflow   - Reiniciar aplicação"
}

# Função principal
main() {
    log_info "Iniciando instalação do WhatsFlow..."
    
    check_root
    detect_system
    
    case ${1:-"--interactive"} in
        --full)
            install_system_deps
            install_nodejs
            setup_postgresql
            setup_application
            setup_pm2
            final_check
            ;;
        --help)
            echo "Uso: $0 [--full|--help]"
            echo "  --full: Instalação completa automatizada"
            echo "  --help: Mostra esta ajuda"
            ;;
        *)
            log_error "Para instalação completa use: $0 --full"
            exit 1
            ;;
    esac
}

# Executar
main "$@"