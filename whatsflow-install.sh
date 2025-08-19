#!/bin/bash

# WhatsFlow - Script de Instalação Simplificado
# Versão: 4.0 - Script limpo e organizado

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detectar sistema
detect_system() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
    else
        log_error "Sistema não suportado"
        exit 1
    fi
    log_info "Sistema: $OS"
}

# Configurar usuário
setup_user() {
    if [[ $EUID -eq 0 ]]; then
        if ! id "whatsflow" &>/dev/null; then
            log_info "Criando usuário whatsflow..."
            useradd -m -s /bin/bash whatsflow
            case $OS in
                ubuntu|debian) usermod -aG sudo whatsflow ;;
                centos|rhel|rocky|alma) usermod -aG wheel whatsflow ;;
            esac
            
            # Solicitar senha do usuário
            echo -n "Defina uma senha para o usuário whatsflow: "
            read -s WHATSFLOW_PASSWORD
            echo
            echo -n "Confirme a senha: "
            read -s WHATSFLOW_PASSWORD_CONFIRM
            echo
            
            if [[ "$WHATSFLOW_PASSWORD" != "$WHATSFLOW_PASSWORD_CONFIRM" ]]; then
                log_error "Senhas não coincidem!"
                exit 1
            fi
            
            echo "whatsflow:$WHATSFLOW_PASSWORD" | chpasswd
            log_success "Senha definida para usuário whatsflow"
        fi
        echo "whatsflow ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/whatsflow-temp
        
        # Copiar script para diretório acessível
        SCRIPT_PATH=$(realpath "$0")
        cp "$SCRIPT_PATH" /home/whatsflow/whatsflow-install.sh
        chown whatsflow:whatsflow /home/whatsflow/whatsflow-install.sh
        chmod +x /home/whatsflow/whatsflow-install.sh
        
        log_info "Continuando como whatsflow..."
        exec sudo -u whatsflow /home/whatsflow/whatsflow-install.sh "$@"
    fi
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências..."
    case $OS in
        ubuntu|debian)
            sudo apt update
            sudo apt install -y curl wget git build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx
            # Node.js 18 para Ubuntu/Debian
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        centos|rhel|rocky|alma)
            sudo dnf update -y
            sudo dnf install -y curl wget git gcc gcc-c++ make postgresql postgresql-server postgresql-contrib nginx certbot python3-certbot-nginx
            # Node.js 18 para CentOS/RHEL
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo dnf install -y nodejs
            ;;
    esac
    
    sudo npm install -g pm2
    
    # Configurar firewall
    log_info "Configurando firewall..."
    if command -v ufw &> /dev/null; then
        sudo ufw --force enable
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp  
        sudo ufw allow 443/tcp
        sudo ufw allow 5000/tcp
    elif command -v firewall-cmd &> /dev/null; then
        sudo systemctl enable firewalld
        sudo systemctl start firewalld
        sudo firewall-cmd --permanent --add-port=22/tcp
        sudo firewall-cmd --permanent --add-port=80/tcp
        sudo firewall-cmd --permanent --add-port=443/tcp
        sudo firewall-cmd --permanent --add-port=5000/tcp
        sudo firewall-cmd --reload
    fi
    
    log_success "Dependências instaladas"
}

# Variável global para senha do banco
DB_PASSWORD=""

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
    
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    
    # Aguardar PostgreSQL iniciar
    sleep 3
    
    # Verificar se PostgreSQL está rodando
    if ! sudo systemctl is-active --quiet postgresql; then
        log_error "Falha ao iniciar PostgreSQL"
        return 1
    fi
    
    echo -n "Senha para usuário PostgreSQL 'whatsflow': "
    read -s DB_PASSWORD
    echo
    
    # Validar senha não vazia
    if [[ -z "$DB_PASSWORD" ]]; then
        log_error "Senha não pode ser vazia"
        return 1
    fi
    
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

# Baixar e configurar aplicação
install_application() {
    log_info "Instalando aplicação..."
    
    cd /home/whatsflow
    rm -rf ZapStatus-para-Woocommerce
    
    echo -n "Branch (padrão: main): "
    read BRANCH
    BRANCH=${BRANCH:-main}
    
    git clone -b $BRANCH https://github.com/NilsonFarias/ZapStatus-para-Woocommerce.git
    cd ZapStatus-para-Woocommerce
    
    # Configurar .env ANTES de instalar
    log_info "Configurando .env..."
    cp .env.example .env
    
    # Configurar DATABASE_URL
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
    
    # Gerar SESSION_SECRET
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
    
    # Instalar e buildar
    npm ci
    npm run build
    
    # Executar migrações do banco
    log_info "Executando migrações..."
    npm run db:push
    
    # Criar arquivo de configuração PM2 (extensão .cjs para compatibilidade)
    cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'npm',
    args: 'start',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF
    
    # Parar PM2 anterior
    pm2 delete whatsflow 2>/dev/null || true
    
    # Iniciar aplicação com arquivo de configuração
    cd "$APP_DIR"
    pm2 start ecosystem.config.cjs
    
    # Verificar se aplicação subiu
    sleep 5
    if pm2 list | grep -q "whatsflow.*online"; then
        log_success "Aplicação iniciada com sucesso"
    else
        log_error "Falha ao iniciar aplicação"
        log_error "Verificando logs..."
        pm2 logs whatsflow --lines 10 --nostream
        return 1
    fi
    
    # Auto-start PM2
    log_info "Configurando PM2 startup..."
    
    # Gerar comando de startup
    STARTUP_CMD=$(pm2 startup systemd -u whatsflow --hp /home/whatsflow 2>&1 | grep "sudo env" || echo "")
    
    if [[ -n "$STARTUP_CMD" ]]; then
        log_info "Executando configuração do PM2 startup..."
        eval "$STARTUP_CMD"
        
        # Salvar lista de processos PM2
        pm2 save
        
        # Verificar se startup foi configurado
        if systemctl is-enabled pm2-whatsflow >/dev/null 2>&1; then
            log_success "PM2 startup configurado com sucesso"
            log_info "Aplicação será reiniciada automaticamente após reboot"
        else
            log_warning "PM2 startup configurado, mas verificação falhou"
        fi
    else
        log_warning "Não foi possível configurar PM2 startup automaticamente"
        log_info "Execute manualmente: sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u whatsflow --hp /home/whatsflow"
    fi
    
    log_success "Aplicação instalada"
}

# Configurar SSL/Domínio
setup_ssl() {
    log_info "Configurando SSL e domínio..."
    
    echo -n "Domínio (ex: mylist.center): "
    read DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        log_warning "Domínio não informado"
        return
    fi
    
    echo -n "Email para SSL: "
    read EMAIL
    if [[ -z "$EMAIL" ]]; then
        log_warning "Email não informado"
        return
    fi
    
    # Configuração Nginx baseada no sistema
    case $OS in
        ubuntu|debian)
            # Criar diretório sites-enabled se não existir
            sudo mkdir -p /etc/nginx/sites-enabled
            
            # Ubuntu/Debian usa sites-available/sites-enabled
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
            # CentOS/RHEL usa conf.d
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
            # Remover configuração default do CentOS
            sudo rm -f /etc/nginx/conf.d/default.conf
            ;;
    esac
    
    # Habilitar e iniciar nginx ANTES de testar
    sudo systemctl enable nginx
    sudo systemctl start nginx
    
    if sudo nginx -t; then
        sudo systemctl reload nginx
        
        # SSL
        log_warning "IMPORTANTE: Antes de configurar SSL, certifique-se que:"
        log_warning "1. O domínio $DOMAIN aponta para este IP"
        log_warning "2. O domínio está propagado (pode levar até 24h)"
        echo -n "Continuar com SSL? (s/N): "
        read SSL_CONFIRM
        
        if [[ "$SSL_CONFIRM" =~ ^[Ss]$ ]]; then
            if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect; then
                log_success "SSL configurado: https://$DOMAIN"
            else
                log_warning "SSL falhou: http://$DOMAIN"
                log_info "Configure SSL depois com: sudo certbot --nginx -d $DOMAIN"
            fi
        else
            log_info "SSL não configurado. Acesse: http://$DOMAIN"
            log_info "Configure SSL depois com: sudo certbot --nginx -d $DOMAIN"
        fi
    else
        log_error "Erro no Nginx"
    fi
}

# Atualizar sistema
update_system() {
    log_info "Atualizando sistema..."
    
    cd /home/whatsflow/ZapStatus-para-Woocommerce
    
    # Backup
    cp .env .env.backup
    
    # Atualizar código
    git pull
    
    # Reinstalar dependências
    npm ci
    npm run build
    
    # Reiniciar aplicação
    pm2 restart whatsflow
    
    log_success "Sistema atualizado"
}

# Menu principal
show_menu() {
    clear
    echo "=========================================="
    echo "        WHATSFLOW - INSTALADOR"
    echo "=========================================="
    echo
    echo "1. Instalar sistema completo"
    echo "2. Atualizar o sistema"
    echo "3. Certbot/SSL e alterar domínio"
    echo "0. Sair"
    echo
    echo -n "Escolha uma opção: "
    read choice
    
    case $choice in
        1) install_complete ;;
        2) update_system ;;
        3) setup_ssl ;;
        0) exit 0 ;;
        *) log_error "Opção inválida" && sleep 2 && show_menu ;;
    esac
}

# Instalação completa
install_complete() {
    install_dependencies
    setup_database
    install_application
    setup_ssl
    
    # Limpar sudo temporário
    sudo rm -f /etc/sudoers.d/whatsflow-temp
    echo "whatsflow ALL=(ALL:ALL) ALL" | sudo tee /etc/sudoers.d/whatsflow > /dev/null
    
    log_success "Instalação completa!"
    log_info "Login: admin / admin123"
    log_info "Configure senha: passwd whatsflow"
    
    read -p "Pressione Enter para continuar..."
    show_menu
}

# Função principal
main() {
    detect_system
    setup_user
    show_menu
}

main "$@"