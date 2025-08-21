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

print_success "Evolution API configuration updated!"
print_status "URL: $EVOLUTION_URL"
print_status "Key: ${API_KEY:0:10}..."
print_warning "Test the configuration in the WhatsFlow admin panel"

print_status "Done!"