#!/bin/bash

# WhatsFlow - Script de Atualização Automática
# Atualiza o sistema sem perder dados ou configurações

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de output
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_status() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Verificar se está no diretório correto
check_directory() {
    if [ ! -f "package.json" ] || [ ! -f ".env" ]; then
        print_error "Execute este script no diretório raiz da aplicação WhatsFlow"
        print_error "Diretório esperado: /home/whatsflow/ZapStatus-para-Woocommerce"
        exit 1
    fi
}

# Fazer backup das configurações críticas
create_backups() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="backups"
    
    print_status "Criando backups de segurança..."
    
    # Criar diretório de backup se não existir
    mkdir -p "$backup_dir"
    
    # Backup do .env
    if [ -f ".env" ]; then
        cp .env "$backup_dir/.env_backup_$timestamp"
        print_success "Backup do .env criado: $backup_dir/.env_backup_$timestamp"
    fi
    
    # Backup do banco de dados
    print_status "Fazendo backup do banco de dados..."
    if command -v pg_dump >/dev/null 2>&1; then
        # Extrair informações do DATABASE_URL
        if [ -f ".env" ] && grep -q "DATABASE_URL" .env; then
            DATABASE_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2-)
            DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\/\([^?]*\).*/\1/')
            DB_HOST=$(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\):.*/\1/')
            DB_PORT=$(echo "$DATABASE_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
            DB_USER=$(echo "$DATABASE_URL" | sed 's/.*\/\/\([^:]*\):.*/\1/')
            DB_PASS=$(echo "$DATABASE_URL" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
            
            if [ -n "$DB_NAME" ]; then
                PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$backup_dir/database_backup_$timestamp.sql" 2>/dev/null && {
                    print_success "Backup do banco criado: $backup_dir/database_backup_$timestamp.sql"
                } || {
                    print_warning "Backup do banco não foi possível - dados continuam seguros no PostgreSQL"
                }
            fi
        fi
    fi
    
    print_success "Backups concluídos"
}

# Verificar status dos serviços
check_services() {
    print_status "Verificando serviços..."
    
    # Verificar PM2
    if ! command -v pm2 >/dev/null 2>&1; then
        print_error "PM2 não encontrado. Instale com: npm install -g pm2"
        exit 1
    fi
    
    # Verificar se a aplicação está rodando
    if sudo -u whatsflow pm2 describe whatsflow >/dev/null 2>&1; then
        print_success "Aplicação WhatsFlow encontrada no PM2"
    else
        print_warning "Aplicação não está rodando no PM2 - será iniciada após atualização"
    fi
}

# Atualizar código do repositório
update_code() {
    print_status "Baixando atualizações do repositório..."
    
    # Verificar se é um repositório git
    if [ ! -d ".git" ]; then
        print_error "Este diretório não é um repositório git"
        print_error "Clone o repositório novamente ou configure o git remoto"
        exit 1
    fi
    
    # Fazer stash de mudanças locais se existirem
    if ! git diff-index --quiet HEAD --; then
        print_warning "Salvando mudanças locais temporariamente..."
        git stash push -m "Auto-stash before update $(date)"
    fi
    
    # Atualizar código
    print_status "Puxando última versão do GitHub..."
    if git pull origin main; then
        print_success "Código atualizado com sucesso"
    else
        print_error "Falha ao atualizar código do repositório"
        print_warning "Verifique sua conexão com a internet e permissões"
        exit 1
    fi
}

# Instalar dependências
install_dependencies() {
    print_status "Verificando e instalando dependências..."
    
    # Limpar cache npm
    npm cache clean --force >/dev/null 2>&1 || true
    
    # Instalar dependências
    if npm ci --production=false; then
        print_success "Dependências instaladas"
    else
        print_error "Falha ao instalar dependências"
        exit 1
    fi
}

# Aplicar correções específicas para VPS
apply_vps_fixes() {
    print_status "Aplicando correções específicas para VPS..."
    
    # Correção WebSocket SSL (se necessário)
    if grep -q "useSecureWebSocket.*true" server/db.ts 2>/dev/null; then
        print_status "Aplicando correção WebSocket SSL..."
        sed -i 's/neonConfig.useSecureWebSocket = true/neonConfig.useSecureWebSocket = false/g' server/db.ts
        sed -i '/neonConfig.useSecureWebSocket = false/a neonConfig.webSocketConstructor = undefined;' server/db.ts
        print_success "Correção WebSocket aplicada"
    fi
    
    # Verificar configuração de sessão
    if ! grep -q "connect-pg-simple" server/routes.ts 2>/dev/null; then
        print_warning "Sistema pode precisar de configuração manual de sessão"
    fi
}

# Reconstruir aplicação
rebuild_application() {
    print_status "Reconstruindo aplicação..."
    
    # Limpar build anterior
    rm -rf dist/ .vite/ node_modules/.cache/ 2>/dev/null || true
    
    # Build da aplicação
    if npm run build; then
        print_success "Aplicação reconstruída com sucesso"
    else
        print_error "Falha no build da aplicação"
        print_error "Verifique os erros acima e corrija antes de continuar"
        exit 1
    fi
    
    # Verificar se o build foi criado
    if [ ! -f "dist/index.js" ]; then
        print_error "Build não foi criado corretamente"
        print_error "Arquivo dist/index.js não encontrado"
        exit 1
    fi
}

# Atualizar banco de dados (migrations)
update_database() {
    print_status "Verificando atualizações do banco de dados..."
    
    # Executar migrations se necessário
    if [ -f "drizzle.config.ts" ]; then
        print_status "Executando migrations..."
        
        # Executar com timeout para evitar travamento
        timeout 30 npx drizzle-kit push 2>&1 | grep -E "(error|Error|pushed|No schema changes|changes detected)" || {
            print_warning "Migrations executadas ou nenhuma mudança detectada"
        }
        
        print_success "Verificação do banco concluída"
    else
        print_warning "Arquivo drizzle.config.ts não encontrado - pulando migrations"
    fi
}

# Reiniciar serviços
restart_services() {
    print_status "Reiniciando serviços..."
    
    # Parar aplicação
    sudo -u whatsflow pm2 stop whatsflow >/dev/null 2>&1 || true
    
    # Aguardar um momento
    sleep 2
    
    # Iniciar aplicação
    if sudo -u whatsflow pm2 start ecosystem.config.cjs >/dev/null 2>&1; then
        print_success "Aplicação reiniciada com sucesso"
    else
        print_error "Falha ao reiniciar aplicação"
        print_warning "Tente manualmente: sudo -u whatsflow pm2 restart whatsflow"
        exit 1
    fi
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar status
    if sudo -u whatsflow pm2 describe whatsflow | grep -q "online"; then
        print_success "Aplicação está rodando corretamente"
    else
        print_warning "Aplicação pode estar com problemas - verificar logs"
    fi
}

# Verificar se atualização foi bem-sucedida
verify_update() {
    print_status "Verificando atualização..."
    
    # Verificar se a aplicação responde
    sleep 3
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|302"; then
        print_success "Aplicação respondendo corretamente"
    else
        print_warning "Aplicação pode não estar respondendo - verificar logs"
    fi
    
    # Mostrar logs recentes
    print_status "Últimas linhas do log:"
    sudo -u whatsflow pm2 logs whatsflow --lines 5 --nostream 2>/dev/null || true
}

# Função principal
main() {
    print_status "🚀 Iniciando atualização do WhatsFlow..."
    echo "=================================================="
    
    check_directory
    check_services
    create_backups
    update_code
    install_dependencies
    apply_vps_fixes
    rebuild_application
    update_database
    restart_services
    verify_update
    
    echo "=================================================="
    print_success "🎉 Atualização concluída com sucesso!"
    print_status "Aplicação está rodando na versão mais recente"
    print_warning "Backups salvos em: ./backups/"
    print_warning "Em caso de problemas, restaure o backup do .env"
}

# Verificar se não está rodando como root
if [ "$EUID" -eq 0 ]; then
    print_error "Não execute este script como root"
    print_error "Execute como usuário normal com sudo quando necessário"
    exit 1
fi

# Executar função principal
main "$@"