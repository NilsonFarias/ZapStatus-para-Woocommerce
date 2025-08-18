#!/bin/bash

# WhatsFlow - Script de Atualização
# Atualiza a aplicação preservando configurações

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Verificar se está no diretório correto
check_directory() {
    if [[ ! -f "package.json" ]] || [[ ! -d "server" ]] || [[ ! -d "client" ]]; then
        log_error "Execute este script no diretório raiz do WhatsFlow"
        exit 1
    fi
}

# Fazer backup
create_backup() {
    log_info "Criando backup..."
    
    BACKUP_DIR="../whatsflow-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Backup de arquivos importantes
    mkdir -p $BACKUP_DIR
    cp .env $BACKUP_DIR/ 2>/dev/null || log_warning "Arquivo .env não encontrado"
    cp -r migrations $BACKUP_DIR/ 2>/dev/null || true
    
    # Backup do banco
    if command -v pg_dump >/dev/null 2>&1; then
        log_info "Fazendo backup do banco de dados..."
        source .env
        DB_URL_PARTS=(${DATABASE_URL//\// })
        DB_HOST_PORT=(${DB_URL_PARTS[2]//@/ })
        DB_CREDS=(${DB_HOST_PORT[0]//:/ })
        DB_USER=${DB_CREDS[0]}
        DB_PASS=${DB_CREDS[1]}
        DB_HOST_INFO=(${DB_HOST_PORT[1]//:/ })
        DB_HOST=${DB_HOST_INFO[0]}
        DB_PORT=${DB_HOST_INFO[1]}
        DB_NAME=${DB_URL_PARTS[3]}
        
        PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > $BACKUP_DIR/database-backup.sql
        log_success "Backup do banco salvo em $BACKUP_DIR/database-backup.sql"
    fi
    
    log_success "Backup criado em $BACKUP_DIR"
}

# Atualizar código
update_code() {
    log_info "Atualizando código..."
    
    # Verificar se há mudanças locais
    if ! git diff-index --quiet HEAD --; then
        log_warning "Há mudanças não commitadas. Criando stash..."
        git stash push -m "Auto-stash antes da atualização $(date)"
    fi
    
    # Puxar atualizações
    git fetch origin
    
    CURRENT_BRANCH=$(git branch --show-current)
    log_info "Branch atual: $CURRENT_BRANCH"
    
    git pull origin $CURRENT_BRANCH
    
    log_success "Código atualizado"
}

# Atualizar dependências
update_dependencies() {
    log_info "Atualizando dependências..."
    
    # Limpar cache npm
    npm cache clean --force
    
    # Instalar dependências
    npm ci
    
    log_success "Dependências atualizadas"
}

# Executar migrações
run_migrations() {
    log_info "Executando migrações do banco..."
    
    npm run migrate
    
    log_success "Migrações executadas"
}

# Build da aplicação
build_application() {
    log_info "Fazendo build da aplicação..."
    
    npm run build
    
    log_success "Build concluído"
}

# Reiniciar serviços
restart_services() {
    log_info "Reiniciando serviços..."
    
    # Reiniciar PM2
    if command -v pm2 >/dev/null 2>&1; then
        pm2 restart whatsflow || pm2 start npm --name "whatsflow" -- start
        log_success "PM2 reiniciado"
    fi
    
    # Reiniciar Nginx (se necessário)
    if systemctl is-active --quiet nginx; then
        sudo nginx -t && sudo systemctl reload nginx
        log_success "Nginx recarregado"
    fi
}

# Verificar saúde
health_check() {
    log_info "Verificando saúde da aplicação..."
    
    # Aguardar inicialização
    sleep 10
    
    # Testar endpoint
    if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        log_success "Aplicação está funcionando corretamente"
        
        # Mostrar status PM2
        if command -v pm2 >/dev/null 2>&1; then
            pm2 show whatsflow
        fi
    else
        log_error "Aplicação não está respondendo"
        log_info "Verificando logs..."
        
        if command -v pm2 >/dev/null 2>&1; then
            pm2 logs whatsflow --lines 20
        fi
        
        return 1
    fi
}

# Limpeza pós-atualização
cleanup() {
    log_info "Executando limpeza..."
    
    # Limpar arquivos temporários
    npm cache clean --force
    
    # Limpar logs antigos do PM2
    if command -v pm2 >/dev/null 2>&1; then
        pm2 flush whatsflow
    fi
    
    log_success "Limpeza concluída"
}

# Função principal
main() {
    echo -e "${BLUE}=== WhatsFlow - Atualização Automatizada ===${NC}"
    echo
    
    check_directory
    
    case ${1:-"--interactive"} in
        --full)
            create_backup
            update_code
            update_dependencies
            run_migrations
            build_application
            restart_services
            health_check
            cleanup
            ;;
        --code-only)
            update_code
            build_application
            restart_services
            health_check
            ;;
        --deps-only)
            update_dependencies
            build_application
            restart_services
            health_check
            ;;
        --interactive|*)
            echo "Selecione o tipo de atualização:"
            echo "1) Atualização completa (recomendado)"
            echo "2) Apenas código"
            echo "3) Apenas dependências"
            echo "4) Verificar saúde"
            echo "0) Cancelar"
            echo
            read -p "Opção: " OPTION
            
            case $OPTION in
                1)
                    create_backup
                    update_code
                    update_dependencies
                    run_migrations
                    build_application
                    restart_services
                    health_check
                    cleanup
                    ;;
                2)
                    create_backup
                    update_code
                    build_application
                    restart_services
                    health_check
                    ;;
                3)
                    create_backup
                    update_dependencies
                    build_application
                    restart_services
                    health_check
                    ;;
                4)
                    health_check
                    ;;
                0)
                    log_info "Atualização cancelada"
                    exit 0
                    ;;
                *)
                    log_error "Opção inválida"
                    exit 1
                    ;;
            esac
            ;;
    esac
    
    echo
    log_success "=== ATUALIZAÇÃO CONCLUÍDA ==="
    echo
    log_info "Comandos úteis:"
    echo "  pm2 status              - Status da aplicação"
    echo "  pm2 logs whatsflow      - Logs em tempo real"
    echo "  pm2 monit               - Monitor de recursos"
    echo "  curl http://localhost:5000/api/health - Teste de saúde"
}

# Executar
main "$@"