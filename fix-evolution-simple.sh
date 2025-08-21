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

# Solicitar URL completa da Evolution API e API key
read -p "Enter your Evolution API URL (e.g., https://evolution.yourserver.com): " EVOLUTION_URL
read -p "Enter your Evolution API key: " API_KEY

print_status "Configuring Evolution API..."
print_status "URL: $EVOLUTION_URL"
print_status "Key: ${API_KEY:0:10}..."

# Navegar para o diretório da aplicação
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Verificar se existe o arquivo .env
if [ ! -f .env ]; then
    print_error "File .env not found in /home/whatsflow/ZapStatus-para-Woocommerce"
    exit 1
fi

# Criar backup do .env
sudo -u whatsflow cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
print_status "Created backup of .env"

# Atualizar as variáveis da Evolution API no .env
print_status "Updating .env file..."

# Remover trailing slash da URL se existir
EVOLUTION_URL=$(echo "$EVOLUTION_URL" | sed 's/\/$//')

# Atualizar ou adicionar as variáveis
if grep -q "EVOLUTION_API_URL=" .env; then
    sudo -u whatsflow sed -i "s|EVOLUTION_API_URL=.*|EVOLUTION_API_URL=${EVOLUTION_URL}|g" .env
else
    echo "EVOLUTION_API_URL=${EVOLUTION_URL}" | sudo -u whatsflow tee -a .env > /dev/null
fi

if grep -q "EVOLUTION_API_KEY=" .env; then
    sudo -u whatsflow sed -i "s|EVOLUTION_API_KEY=.*|EVOLUTION_API_KEY=${API_KEY}|g" .env
else
    echo "EVOLUTION_API_KEY=${API_KEY}" | sudo -u whatsflow tee -a .env > /dev/null
fi

print_success "Updated .env file"

# Verificar se as alterações foram aplicadas
print_status "Verifying .env configuration..."
grep "EVOLUTION_API" .env

# Reiniciar a aplicação para aplicar as mudanças
print_status "Restarting WhatsFlow application..."
sudo -u whatsflow pm2 restart whatsflow

# Aguardar um pouco para a aplicação reiniciar
sleep 5

# Verificar status
print_status "Checking application status..."
sudo -u whatsflow pm2 status

# Atualizar configurações no banco de dados também
print_status "Updating database settings..."

# Encontrar o nome do banco
DB_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2-)
DB_NAME=$(echo "$DB_URL" | grep -o '/[^?]*' | cut -d'/' -f2 | cut -d'?' -f1)

if [ -z "$DB_NAME" ]; then
    DB_NAME="neondb"  # fallback comum
fi

print_status "Using database: $DB_NAME"

# Script SQL simples
cat > /tmp/update_evolution.sql << EOF
UPDATE system_settings SET value = '$EVOLUTION_URL' WHERE key = 'evolution_api_url';
UPDATE system_settings SET value = '$API_KEY' WHERE key = 'evolution_api_key';
INSERT INTO system_settings (key, value, description) VALUES ('evolution_api_url', '$EVOLUTION_URL', 'Evolution API URL') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO system_settings (key, value, description) VALUES ('evolution_api_key', '$API_KEY', 'Evolution API Key') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
EOF

# Tentar atualizar o banco
sudo -u postgres psql -d "$DB_NAME" -f /tmp/update_evolution.sql 2>/dev/null || {
    print_warning "Could not update database directly"
    print_warning "You'll need to configure in the admin panel manually"
}

# Limpar arquivo temporário
rm -f /tmp/update_evolution.sql

print_success "Evolution API configuration updated!"
print_status "URL: $EVOLUTION_URL"
print_status "Key: ${API_KEY:0:10}..."
print_warning "Check the admin panel - fields should be pre-filled now"

print_status "Done!"