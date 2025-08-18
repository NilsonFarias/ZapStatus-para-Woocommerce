#!/bin/bash

# WhatsFlow - Script de Instalação Simplificado
# Versão: 2.0
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
        
        # Executar como whatsflow
        log_info "Continuando instalação como whatsflow..."
        sudo -u whatsflow -i bash -s -- "$@" << 'EOF'
#!/bin/bash
export USER=whatsflow
export HOME=/home/whatsflow
cd /home/whatsflow

# Re-executar este script como whatsflow
curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/install-simple.sh | bash -s -- "$@"
EOF
        
        # Limpar configuração temporária
        rm -f /etc/sudoers.d/whatsflow-install
        
        # Configurar sudo permanente (com senha)
        echo "whatsflow ALL=(ALL:ALL) ALL" > /etc/sudoers.d/whatsflow
        
        log_success "Instalação concluída! Configure senha: passwd whatsflow"
        exit 0
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
    read -s -p "Senha para banco PostgreSQL 'whatsflow': " DB_PASSWORD
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
    read -p "Branch (padrão: main): " BRANCH
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
    pm2 startup
    pm2 save
    
    log_success "Aplicação instalada e iniciada"
}

# Menu principal
show_menu() {
    echo "=== WhatsFlow - Instalação Simplificada ==="
    echo "1. Instalação completa"
    echo "2. Apenas dependências"
    echo "3. Apenas aplicação"
    echo "0. Sair"
    read -p "Escolha uma opção: " choice
    
    case $choice in
        1) full_install ;;
        2) install_dependencies && install_nodejs ;;
        3) setup_postgresql && install_application ;;
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
    
    log_success "Instalação completa concluída!"
    log_info "Acesse: http://seu-servidor:5000"
    log_info "Login: admin / admin123"
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