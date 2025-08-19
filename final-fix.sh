#!/bin/bash
# Correção final - carregamento de .env

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "=== CORREÇÃO FINAL - CARREGAMENTO .env ==="

# Parar PM2
pm2 delete all 2>/dev/null || true

# Carregar variáveis do .env e executar
echo "Carregando .env e testando aplicação..."
set -a  # Exportar automaticamente todas as variáveis
source .env
set +a

# Verificar se DATABASE_URL foi carregado
echo "DATABASE_URL: $DATABASE_URL"

# Testar aplicação com variáveis carregadas
echo "Testando aplicação com variáveis de ambiente..."
NODE_ENV=production node dist/index.js &
APP_PID=$!

# Esperar aplicação iniciar
sleep 10

# Verificar se responde
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Aplicação funcionando na porta 5000!"
    kill $APP_PID
    
    # Modificar ecosystem.config.cjs para incluir variáveis explícitas
    echo "Criando ecosystem.config.cjs com variáveis explícitas..."
    cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: '$DATABASE_URL',
      SESSION_SECRET: '$SESSION_SECRET',
      STRIPE_SECRET_KEY: '$STRIPE_SECRET_KEY',
      VITE_STRIPE_PUBLIC_KEY: '$VITE_STRIPE_PUBLIC_KEY',
      STRIPE_BASIC_PRICE_ID: '$STRIPE_BASIC_PRICE_ID',
      STRIPE_PRO_PRICE_ID: '$STRIPE_PRO_PRICE_ID',
      STRIPE_ENTERPRISE_PRICE_ID: '$STRIPE_ENTERPRISE_PRICE_ID',
      EVOLUTION_API_KEY: '$EVOLUTION_API_KEY',
      EVOLUTION_API_URL: '$EVOLUTION_API_URL'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10
  }]
};
EOF
    
    # Iniciar PM2 com configuração atualizada
    echo "Iniciando PM2 com variáveis explícitas..."
    pm2 start ecosystem.config.cjs
    pm2 save
    
    # Verificar se funcionou
    sleep 10
    if curl -s http://localhost:5000 > /dev/null 2>&1; then
        echo "✅ SUCESSO TOTAL! Aplicação rodando com PM2 na porta 5000"
        pm2 list
        echo "Configuração salva. Aplicação persistirá após reinicializações."
    else
        echo "❌ PM2 iniciou mas porta 5000 não responde"
        pm2 logs whatsflow --lines 10 --nostream
    fi
else
    echo "❌ Aplicação falhou mesmo com variáveis carregadas"
    kill $APP_PID 2>/dev/null
    # Mostrar valores das variáveis para debug
    echo "DEBUG - Variáveis carregadas:"
    echo "DATABASE_URL: $DATABASE_URL"
    echo "NODE_ENV: $NODE_ENV"
fi