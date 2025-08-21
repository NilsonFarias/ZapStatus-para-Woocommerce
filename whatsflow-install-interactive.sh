#!/bin/bash

# WhatsFlow Installation Script - Interactive Version
# Versão que baixa o script primeiro para resolver problemas de stdin
# Autor: WhatsFlow Team
# Data: 2025-08-21

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funções de print
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar se está rodando como root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Do not run this script as root. Run as regular user with sudo privileges."
        exit 1
    fi
}

# Função principal
main() {
    print_status "WhatsFlow Interactive Installer"
    print_status "================================"
    
    # Verificar se não é root
    check_root
    
    # Baixar script principal
    print_status "Downloading installation script..."
    curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/whatsflow-install-fixed.sh -o /tmp/whatsflow-install.sh
    chmod +x /tmp/whatsflow-install.sh
    
    print_success "Script downloaded successfully"
    print_status "Starting interactive installation..."
    
    # Executar com stdin preservado
    /tmp/whatsflow-install.sh --full
    
    # Limpar arquivo temporário
    rm -f /tmp/whatsflow-install.sh
}

# Executar função principal
main "$@"