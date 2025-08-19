#!/bin/bash

# Script completo para corrigir problemas de registro
# Execute como: sudo -u whatsflow bash fix-registration-complete.sh

set -e

echo "=== Correção Completa do Problema de Registro ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

echo "1. Parando aplicação temporariamente..."
pm2 stop whatsflow || true

echo
echo "2. Verificando e carregando variáveis de ambiente..."
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    exit 1
fi

source .env

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL não definida!"
    exit 1
fi

echo "✅ Variáveis de ambiente carregadas"

echo
echo "3. Testando conexão com banco de dados..."
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function testConnection() {
  try {
    const result = await sql\`SELECT 1 as test\`;
    console.log('✅ Conexão com banco OK');
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    process.exit(1);
  }
}

testConnection();
"

echo
echo "4. Forçando recriação da estrutura do banco..."
echo "   (Executando migrações com --force)"

# Executar push do schema forçado
npm run db:push -- --force || {
    echo "❌ Falha ao aplicar schema"
    echo "Tentando método alternativo..."
    
    # Tentar método direto com drizzle-kit
    npx drizzle-kit push --config=drizzle.config.ts || {
        echo "❌ Falha total nas migrações"
        exit 1
    }
}

echo "✅ Schema aplicado com sucesso"

echo
echo "5. Verificando estrutura das tabelas essenciais..."
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function verifyTables() {
  try {
    // Verificar tabelas existentes
    const tables = await sql\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    \`;
    
    console.log('📋 Tabelas no banco:');
    tables.forEach(t => console.log('  -', t.table_name));
    
    const requiredTables = ['users', 'clients'];
    const existingTables = tables.map(t => t.table_name);
    
    for (const table of requiredTables) {
      if (!existingTables.includes(table)) {
        console.error(\`❌ Tabela \${table} não encontrada!\`);
        process.exit(1);
      }
    }
    
    // Verificar estrutura da tabela users
    const userColumns = await sql\`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    \`;
    
    console.log('\\n📋 Estrutura da tabela users:');
    userColumns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(\`  \${col.column_name}: \${col.data_type} \${nullable}\`);
    });
    
    // Verificar campos obrigatórios
    const requiredColumns = ['id', 'email', 'password', 'name'];
    const existingColumns = userColumns.map(c => c.column_name);
    
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column)) {
        console.error(\`❌ Campo \${column} não encontrado na tabela users!\`);
        process.exit(1);
      }
    }
    
    console.log('✅ Estrutura das tabelas OK');
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error.message);
    process.exit(1);
  }
}

verifyTables();
"

echo
echo "6. Criando tabela de sessões se necessário..."
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function ensureSessionTable() {
  try {
    // Verificar se tabela sessions existe
    const tables = await sql\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'sessions'
    \`;
    
    if (tables.length === 0) {
      console.log('🔧 Criando tabela sessions...');
      
      await sql\`
        CREATE TABLE sessions (
          sid VARCHAR(255) PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      \`;
      
      await sql\`CREATE INDEX sessions_expire_idx ON sessions (expire)\`;
      
      console.log('✅ Tabela sessions criada');
    } else {
      console.log('✅ Tabela sessions já existe');
    }
    
  } catch (error) {
    console.error('❌ Erro com tabela sessions:', error.message);
  }
}

ensureSessionTable();
"

echo
echo "7. Reiniciando aplicação..."
pm2 start whatsflow || pm2 restart whatsflow

echo "   Aguardando inicialização..."
sleep 10

# Verificar se aplicação está rodando
if ! pm2 list | grep -q "whatsflow.*online"; then
    echo "❌ Aplicação não iniciou corretamente"
    echo "Logs do PM2:"
    pm2 logs whatsflow --lines 20 --nostream
    exit 1
fi

echo "✅ Aplicação reiniciada"

echo
echo "8. Testando endpoint de registro..."

TEST_EMAIL="fix-test-$(date +%s)@example.com"

# Teste com dados mínimos
RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"test123456\",
    \"name\": \"Test User\"
  }" \
  -w "HTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status HTTP: $HTTP_STATUS"
echo "Resposta: $BODY"

if [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ SUCESSO! Registro funcionando corretamente"
    
    # Limpar usuário de teste
    node -e "
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    async function cleanup() {
      try {
        await sql\`DELETE FROM users WHERE email = \${process.argv[1]}\`;
        console.log('🧹 Usuário de teste removido');
      } catch (error) {
        console.log('Note: Erro na limpeza (pode ser ignorado):', error.message);
      }
    }
    
    cleanup();
    " "$TEST_EMAIL"
    
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "❌ AINDA COM ERRO 500"
    echo "Verificando logs detalhados..."
    pm2 logs whatsflow --lines 30 --nostream | tail -20
    
else
    echo "❌ Status inesperado: $HTTP_STATUS"
    echo "Resposta: $BODY"
fi

echo
echo "=== Correção Completa Finalizada ==="
echo
echo "RESUMO:"
echo "- ✅ Conexão com banco verificada"
echo "- ✅ Schema aplicado com força"
echo "- ✅ Tabelas essenciais verificadas"
echo "- ✅ Tabela sessions criada/verificada"
echo "- ✅ Aplicação reiniciada"
echo "- $([ "$HTTP_STATUS" = "201" ] && echo "✅" || echo "❌") Teste de registro: HTTP $HTTP_STATUS"
echo
echo "Para monitorar logs: pm2 logs whatsflow --follow"