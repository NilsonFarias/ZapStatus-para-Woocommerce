#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    exit 1
fi

# Solicitar domínio e API key
read -p "Enter your domain (e.g., app.mylist.center): " DOMAIN
read -p "Enter your Evolution API key: " API_KEY

print_status "Configuring Evolution API for domain: $DOMAIN"

# Navegar para o diretório da aplicação como usuário whatsflow
sudo -u whatsflow bash -c 'cd /home/whatsflow/ZapStatus-para-Woocommerce && pwd'

# Atualizar arquivo .env com as configurações corretas
print_status "Updating .env file..."

# Criar backup do .env
sudo -u whatsflow cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Atualizar as variáveis da Evolution API no .env
sudo -u whatsflow sed -i "s|EVOLUTION_API_URL=.*|EVOLUTION_API_URL=https://${DOMAIN}/v2|g" .env
sudo -u whatsflow sed -i "s|EVOLUTION_API_KEY=.*|EVOLUTION_API_KEY=${API_KEY}|g" .env

print_success "Updated .env file"

# Verificar se as alterações foram aplicadas
print_status "Verifying .env configuration..."
grep "EVOLUTION_API" .env

# Atualizar configurações no banco de dados
print_status "Updating database system settings..."

# Script SQL para atualizar as configurações (executar como root)
tee /tmp/update_evolution_settings.sql > /dev/null << EOF
-- Inserir ou atualizar configurações da Evolution API
INSERT INTO system_settings (key, value, description) 
VALUES ('evolution_api_url', 'https://${DOMAIN}/v2', 'Evolution API Base URL')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO system_settings (key, value, description) 
VALUES ('evolution_api_key', '${API_KEY}', 'Evolution API Key')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Verificar as configurações inseridas
SELECT key, value FROM system_settings WHERE key LIKE 'evolution_api%';
EOF

# Descobrir o nome do banco de dados
DB_NAME=$(sudo -u postgres psql -l | grep -E "(zapstatus|whatsflow|whats)" | head -1 | awk '{print $1}' | grep -v "Name")
if [ -z "$DB_NAME" ]; then
    # Fallback: tentar encontrar o banco baseado no .env
    DB_NAME=$(grep "DATABASE_URL" .env | grep -o "/[^?]*" | cut -d'/' -f2 | cut -d'?' -f1)
fi

print_status "Using database: $DB_NAME"

# Executar o script SQL
sudo -u postgres psql -d "$DB_NAME" -f /tmp/update_evolution_settings.sql

# Limpar arquivo temporário
rm -f /tmp/update_evolution_settings.sql

# Reiniciar a aplicação para aplicar as mudanças
print_status "Restarting WhatsFlow application..."
sudo -u whatsflow pm2 restart whatsflow

# Aguardar um pouco para a aplicação reiniciar
sleep 5

# Verificar status
print_status "Checking application status..."
sudo -u whatsflow pm2 status

print_success "Evolution API configuration updated!"
print_status "API URL: https://${DOMAIN}/v2"
print_status "API Key: ${API_KEY}"
print_warning "Test the configuration in the WhatsFlow admin panel"

print_status "Done!"