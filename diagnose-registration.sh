#!/bin/bash

# Script para diagnosticar problemas de registro na VPS
# Execute como: sudo -u whatsflow bash diagnose-registration.sh

echo "=== Diagnóstico de Problemas de Registro ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

echo
echo "1. Status do PM2:"
pm2 status

echo
echo "2. Últimos logs da aplicação:"
pm2 logs whatsflow --lines 20

echo
echo "3. Testando conexão com banco de dados:"
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function testDb() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql\`SELECT 1 as test\`;
    console.log('✓ Conexão com banco OK:', result);
    
    // Testar se tabela users existe
    const tables = await sql\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    \`;
    console.log('✓ Tabela users:', tables.length > 0 ? 'EXISTS' : 'NOT FOUND');
    
    // Verificar estrutura da tabela users
    const columns = await sql\`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    \`;
    console.log('✓ Colunas da tabela users:');
    columns.forEach(col => {
      console.log(\`  - \${col.column_name}: \${col.data_type} (\${col.is_nullable === 'YES' ? 'nullable' : 'not null'})\`);
    });
    
  } catch (error) {
    console.error('✗ Erro no banco:', error.message);
  }
}

testDb();
"

echo
echo "4. Testando endpoint de registro:"
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "name": "Usuário Teste",
    "company": "Empresa Teste"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo
echo "5. Verificando variáveis de ambiente:"
echo "DATABASE_URL definida: $([ -n "$DATABASE_URL" ] && echo "SIM" || echo "NÃO")"
echo "SESSION_SECRET definida: $([ -n "$SESSION_SECRET" ] && echo "SIM" || echo "NÃO")"

echo
echo "6. Verificando permissões:"
ls -la .env
echo "Usuário atual: $(whoami)"

echo
echo "=== Fim do Diagnóstico ==="
echo "Se o problema persistir, execute: pm2 logs whatsflow --follow"