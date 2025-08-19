#!/bin/bash

# Script corrigido para resolver problema de DATABASE_URL
# Execute como: bash fix-502.sh

set -e

echo "=== CORREÇÃO DO ERRO 502 - DATABASE_URL ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

echo "1. Verificando arquivo .env..."
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    exit 1
fi

echo "✅ Arquivo .env encontrado"
ls -la .env

echo
echo "2. Verificando conteúdo do .env (sem mostrar valores sensíveis)..."
echo "Variáveis no .env:"
grep -E "^[A-Z_]+" .env | cut -d= -f1 | sort

echo
echo "3. Testando carregamento de variáveis com dotenv..."
node -e "
require('dotenv').config({ path: '.env' });
console.log('DATABASE_URL presente:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL começa com postgres:', process.env.DATABASE_URL ? process.env.DATABASE_URL.startsWith('postgres') : 'não definida');
console.log('SESSION_SECRET presente:', !!process.env.SESSION_SECRET);
"

echo
echo "4. Re-criando ecosystem.config.cjs com variáveis explícitas..."

# Carregar variáveis do .env
source .env

# Verificar se DATABASE_URL foi carregada
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL ainda não foi carregada!"
    echo "Conteúdo do .env:"
    cat .env
    exit 1
fi

# Criar novo ecosystem.config.cjs com variáveis explícitas
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
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
    },
    error_file: '/home/whatsflow/logs/err.log',
    out_file: '/home/whatsflow/logs/out.log',
    log_file: '/home/whatsflow/logs/combined.log',
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000
  }]
};
EOF

echo "✅ ecosystem.config.cjs recriado com variáveis explícitas"

echo
echo "5. Criando diretório de logs..."
mkdir -p /home/whatsflow/logs

echo
echo "6. Testando conexão com banco usando as variáveis carregadas..."
DATABASE_URL="$DATABASE_URL" node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function testDb() {
  try {
    console.log('Testando conexão...');
    const result = await sql\`SELECT NOW() as current_time, version() as pg_version\`;
    console.log('✅ Conexão OK:', result[0].current_time);
    console.log('PostgreSQL:', result[0].pg_version.split(' ')[0]);
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    process.exit(1);
  }
}

testDb();
"

echo
echo "7. Verificando se aplicação está compilada..."
if [ ! -f dist/index.js ]; then
    echo "🔧 Compilando aplicação..."
    npm run build
else
    echo "✅ Aplicação já compilada"
fi

echo
echo "8. Aplicando schema do banco..."
DATABASE_URL="$DATABASE_URL" npm run db:push

echo
echo "9. Testando aplicação diretamente antes do PM2..."
echo "Iniciando teste rápido da aplicação..."

# Testar a aplicação por 10 segundos
timeout 10s DATABASE_URL="$DATABASE_URL" SESSION_SECRET="$SESSION_SECRET" node dist/index.js &
APP_PID=$!

sleep 5

# Verificar se está rodando
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ Aplicação inicia corretamente"
    
    # Testar endpoint
    if curl -s http://localhost:5000/api/health > /dev/null; then
        echo "✅ Endpoint responde corretamente"
    else
        echo "⚠️ Endpoint não responde (pode ser normal em teste rápido)"
    fi
    
    # Parar teste
    kill $APP_PID 2>/dev/null || true
    wait $APP_PID 2>/dev/null || true
else
    echo "❌ Aplicação não inicia - verificando logs..."
    wait $APP_PID 2>/dev/null || true
fi

echo
echo "10. Iniciando com PM2..."
pm2 delete whatsflow 2>/dev/null || true
pm2 start ecosystem.config.cjs

echo "Aguardando inicialização..."
sleep 10

echo
echo "11. Verificando status final..."
pm2 status whatsflow

if pm2 list | grep -q "whatsflow.*online"; then
    echo "✅ Aplicação online no PM2"
    
    # Teste final da API
    echo "Testando endpoint de health..."
    if curl -s http://localhost:5000/api/health; then
        echo
        echo "✅ SUCESSO! Aplicação respondendo corretamente"
    else
        echo
        echo "❌ Aplicação online mas não responde"
    fi
else
    echo "❌ Aplicação não está online"
    echo "Logs do PM2:"
    pm2 logs whatsflow --lines 20 --nostream
fi

echo
echo "=== CORREÇÃO FINALIZADA ==="
echo "Para monitorar: pm2 logs whatsflow --follow"
echo "Para status: pm2 status"