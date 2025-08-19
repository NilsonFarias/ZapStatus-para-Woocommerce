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

# Criar ecosystem.config.cjs (extensão .cjs para compatibilidade)
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

echo "Iniciando aplicação com ecosystem.config.cjs..."
pm2 start ecosystem.config.cjs

echo "Salvando configuração PM2..."
pm2 save

echo "Configurando PM2 startup automático..."
STARTUP_CMD=$(pm2 startup systemd -u whatsflow --hp /home/whatsflow 2>&1 | grep "sudo env" || echo "")
if [[ -n "$STARTUP_CMD" ]]; then
    echo "Executando: $STARTUP_CMD"
    eval "$STARTUP_CMD"
    pm2 save
    echo "PM2 startup configurado com sucesso!"
else
    echo "AVISO: PM2 startup não configurado automaticamente"
    echo "Execute manualmente: sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u whatsflow --hp /home/whatsflow"
fi

echo "Status da aplicação:"
pm2 list

echo "Logs da aplicação:"
pm2 logs whatsflow --lines 5 --nostream

echo "Correção concluída!"