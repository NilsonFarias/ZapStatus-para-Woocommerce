#!/bin/bash
# Correção rápida para iniciar aplicação

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "=== CORREÇÃO RÁPIDA ==="

# Parar PM2
pm2 delete all 2>/dev/null || true

# Testar aplicação diretamente
echo "Testando aplicação..."
export NODE_ENV=production
node dist/index.js &
APP_PID=$!

# Esperar 5 segundos
sleep 5

# Verificar se aplicação iniciou
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Aplicação funcionando na porta 5000!"
    kill $APP_PID
    
    # Iniciar com PM2
    echo "Iniciando PM2..."
    pm2 start ecosystem.config.cjs
    pm2 save
    
    # Verificar PM2
    sleep 5
    if pm2 list | grep -q "whatsflow.*online"; then
        echo "✅ PM2 funcionando!"
        if curl -s http://localhost:5000 > /dev/null 2>&1; then
            echo "✅ SUCESSO! Aplicação rodando na porta 5000"
        else
            echo "❌ PM2 rodando mas porta 5000 não responde"
        fi
    else
        echo "❌ PM2 falhou"
        pm2 logs whatsflow --lines 10 --nostream
    fi
else
    echo "❌ Aplicação falhou ao iniciar"
    kill $APP_PID 2>/dev/null
    
    # Mostrar erro
    export NODE_ENV=production
    node dist/index.js
fi