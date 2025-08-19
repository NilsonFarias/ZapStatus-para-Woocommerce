#!/bin/bash
# Script para corrigir PM2 no servidor

echo "Corrigindo configuração PM2..."

# Parar aplicação atual
pm2 delete whatsflow 2>/dev/null || true

# Ir para diretório correto
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "ERRO: Arquivo .env não encontrado!"
    exit 1
fi

# Criar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
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

echo "Iniciando aplicação com ecosystem.config.js..."
pm2 start ecosystem.config.js

echo "Salvando configuração PM2..."
pm2 save

echo "Status da aplicação:"
pm2 list

echo "Logs da aplicação:"
pm2 logs whatsflow --lines 5 --nostream

echo "Correção concluída!"