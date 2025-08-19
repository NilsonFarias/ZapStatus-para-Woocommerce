#!/bin/bash

# CORREÇÃO APLICAÇÃO - PM2 Aplicação está online mas Nginx não conecta
# Execute como: bash fix-app.sh

echo "=== CORRIGINDO APLICAÇÃO PM2 + NGINX ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "1. Parando PM2..."
pm2 stop whatsflow

echo "2. Verificando arquivo .env..."
source .env

echo "3. Testando conexão com banco diretamente..."
DATABASE_URL="$DATABASE_URL" node -e "
const { neon } = require('@neondatabase/serverless');
async function test() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql\`SELECT 1\`;
    console.log('✅ Banco OK');
  } catch(e) {
    console.log('❌ Banco:', e.message);
    process.exit(1);
  }
}
test();
"

echo "4. Aplicando migrações do banco..."
DATABASE_URL="$DATABASE_URL" npm run db:push

echo "5. Recriando ecosystem.config.cjs com bind correto..."
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
      HOST: '0.0.0.0',
      DATABASE_URL: '${DATABASE_URL}',
      SESSION_SECRET: '${SESSION_SECRET}',
      STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY:-sk_test_placeholder}',
      VITE_STRIPE_PUBLIC_KEY: '${VITE_STRIPE_PUBLIC_KEY:-pk_test_placeholder}',
      EVOLUTION_API_KEY: '${EVOLUTION_API_KEY:-placeholder}',
      EVOLUTION_API_URL: '${EVOLUTION_API_URL:-http://localhost:8080}'
    },
    error_file: '/home/whatsflow/logs/err.log',
    out_file: '/home/whatsflow/logs/out.log',
    log_file: '/home/whatsflow/logs/combined.log',
    max_restarts: 5,
    min_uptime: '10s',
    restart_delay: 3000
  }]
};
EOF

echo "6. Criando diretório de logs..."
mkdir -p /home/whatsflow/logs

echo "7. Testando aplicação standalone por 15 segundos..."
timeout 15s DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" node dist/index.js &
TEST_PID=$!

sleep 8

# Verificar se responde
echo "Testando localhost:5000..."
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ Aplicação responde em standalone"
    kill $TEST_PID 2>/dev/null || true
    wait $TEST_PID 2>/dev/null || true
else
    echo "❌ Aplicação NÃO responde em standalone"
    kill $TEST_PID 2>/dev/null || true
    wait $TEST_PID 2>/dev/null || true
    echo "Verificando logs de erro..."
    echo "PROBLEMA: Aplicação não inicia corretamente"
    exit 1
fi

echo "8. Iniciando com PM2..."
pm2 delete whatsflow 2>/dev/null || true
pm2 start ecosystem.config.cjs

echo "Aguardando 10 segundos..."
sleep 10

echo "9. Verificando status PM2..."
pm2 status whatsflow

echo "10. Testando conectividade após PM2..."
if curl -s http://localhost:5000/api/health; then
    echo "✅ Aplicação responde via PM2"
else
    echo "❌ Aplicação NÃO responde via PM2"
    echo "Logs PM2:"
    pm2 logs whatsflow --lines 10 --nostream
    exit 1
fi

echo "11. Verificando bind da porta 5000..."
netstat -tulnp | grep :5000

echo "12. Testando conectividade nginx -> app..."
if curl -s -H "Host: mylist.center" http://127.0.0.1:5000/api/health; then
    echo "✅ Nginx pode conectar na aplicação"
else
    echo "❌ Nginx NÃO consegue conectar"
fi

echo "13. Recarregando nginx..."
sudo systemctl reload nginx

echo "14. Teste final do site..."
if curl -s https://mylist.center/api/health; then
    echo "✅ SITE FUNCIONANDO!"
else
    echo "⚠️ Site ainda com problemas, mas aplicação local OK"
    echo "Nginx pode precisar de ajuste na configuração"
fi

echo
echo "=== APLICAÇÃO CORRIGIDA ==="
echo "Status: PM2 online e respondendo localmente"
echo "Para monitorar: pm2 logs whatsflow --follow"
echo "Para status: pm2 status"