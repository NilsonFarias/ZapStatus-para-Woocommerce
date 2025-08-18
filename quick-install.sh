#!/bin/bash

# WhatsFlow - Instalação Rápida (One-liner)
# Baixa e executa o script completo automaticamente

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== WhatsFlow - Instalação Rápida ===${NC}"
echo

# Baixar script principal
echo -e "${BLUE}[INFO]${NC} Baixando script de instalação..."
curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/whatsflow/main/install.sh -o /tmp/whatsflow-install.sh

# Tornar executável
chmod +x /tmp/whatsflow-install.sh

# Executar
echo -e "${GREEN}[SUCCESS]${NC} Iniciando instalação automatizada..."
echo
bash /tmp/whatsflow-install.sh --full

# Limpar
rm -f /tmp/whatsflow-install.sh

echo -e "${GREEN}[SUCCESS]${NC} Instalação concluída!"