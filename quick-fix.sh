#!/bin/bash

# CORREÇÃO RÁPIDA - Testando aplicação
# Execute como: bash quick-fix.sh

echo "=== CORREÇÃO RÁPIDA ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "1. Parando PM2..."
pm2 stop whatsflow || true

echo "2. Testando aplicação manual..."
source .env
echo "Aplicação testando por 15 segundos..."

# Teste manual da aplicação
timeout 15s node dist/index.js &
APP_PID=$!

sleep 8

# Verificar se respondeu
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Aplicação responde diretamente"
    
    # Parar teste
    kill $APP_PID 2>/dev/null || true
    
    echo "3. Recriando ecosystem com variáveis explícitas..."
    cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '$(pwd)',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: '${DATABASE_URL}',
      SESSION_SECRET: '${SESSION_SECRET}',
      STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY:-sk_test_placeholder}',
      VITE_STRIPE_PUBLIC_KEY: '${VITE_STRIPE_PUBLIC_KEY:-pk_test_placeholder}',
      EVOLUTION_API_KEY: '${EVOLUTION_API_KEY:-placeholder}',
      EVOLUTION_API_URL: '${EVOLUTION_API_URL:-http://localhost:8080}'
    }
  }]
};
EOF
    
    echo "4. Reiniciando PM2..."
    pm2 delete whatsflow 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    
    sleep 5
    pm2 status
    
    echo "5. Teste final..."
    curl -s http://localhost:5000/api/health && echo " ✅" || echo " ❌"
    
else
    echo "❌ Aplicação não responde diretamente"
    kill $APP_PID 2>/dev/null || true
    
    echo "Verificando logs diretos..."
    wait $APP_PID 2>/dev/null || true
fi

echo "=== FIM ==="