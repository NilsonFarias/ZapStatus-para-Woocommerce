#!/bin/bash

# CORREÇÃO PM2 - Copie e cole este script na VPS
# Execute como: bash fix-pm2.sh

echo "=== CORRIGINDO PM2 + DATABASE_URL ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "1. Parando PM2..."
pm2 stop whatsflow || pm2 delete whatsflow

echo "2. Verificando .env..."
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    exit 1
fi

# Carregar variáveis
set -a
source .env
set +a

echo "3. Verificando DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL não definida no .env!"
    exit 1
fi

echo "DATABASE_URL: ${DATABASE_URL:0:20}..."

echo "4. Testando banco..."
DATABASE_URL="$DATABASE_URL" node -e "
const { neon } = require('@neondatabase/serverless');
async function test() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql\`SELECT NOW()\`;
    console.log('✅ Banco OK');
  } catch(e) {
    console.log('❌ Banco falhou:', e.message);
    process.exit(1);
  }
}
test();
"

echo "5. Aplicando schema..."
npm run db:push

echo "6. Criando ecosystem com variáveis fixas..."
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

echo "7. Testando aplicação standalone..."
timeout 10s node dist/index.js &
APP_PID=$!
sleep 5

if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ App inicia OK"
    kill $APP_PID
    wait $APP_PID 2>/dev/null || true
else
    echo "❌ App falha ao iniciar"
    wait $APP_PID 2>/dev/null || true
    exit 1
fi

echo "8. Iniciando PM2..."
pm2 start ecosystem.config.cjs

sleep 5
pm2 status

echo "9. Testando endpoints..."
echo "Health check:"
curl -s http://localhost:5000/api/health && echo " ✅" || echo " ❌"

echo "Página inicial:"
curl -s -I http://localhost:5000/ | head -1

echo "10. Recarregando nginx..."
sudo systemctl reload nginx

echo "=== CONCLUÍDO ==="
echo "Status: PM2 deve estar rodando com DATABASE_URL correta"
echo "Teste o site: https://mylist.center"