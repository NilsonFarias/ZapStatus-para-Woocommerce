#!/bin/bash

# Script detalhado para debug do problema de registro
# Execute como: sudo -u whatsflow bash debug-registration-detailed.sh

echo "=== Debug Detalhado do Registro ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

echo "1. Verificando se aplicação está rodando e logging ativo:"
echo "PM2 Status:"
pm2 status whatsflow

echo
echo "2. Testando conexão básica com banco:"
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function testBasicDb() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    console.log('✓ Conectando ao banco...');
    
    // Teste básico
    const result = await sql\`SELECT NOW() as current_time\`;
    console.log('✓ Banco respondendo:', result[0].current_time);
    
    // Verificar tabelas essenciais
    const tables = await sql\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'clients', 'sessions')
      ORDER BY table_name
    \`;
    
    console.log('✓ Tabelas encontradas:');
    tables.forEach(t => console.log('  -', t.table_name));
    
    if (tables.length < 2) {
      console.log('❌ PROBLEMA: Tabelas essenciais faltando');
      console.log('🔧 Execute: npm run db:push');
    }
    
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

testBasicDb();
"

echo
echo "3. Tentando registro e capturando logs em tempo real:"

# Iniciar captura de logs em background
timeout 30s pm2 logs whatsflow --follow --nostream &
LOGS_PID=$!

sleep 2

# Fazer requisição de teste
echo "Enviando requisição de teste..."
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "debug@test.com",
    "password": "debug123456",
    "name": "Debug User"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

sleep 5

# Parar captura de logs
kill $LOGS_PID 2>/dev/null

echo
echo "4. Verificando estrutura específica da tabela users:"
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkUserTable() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const columns = await sql\`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    \`;
    
    console.log('📋 Estrutura completa da tabela users:');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const maxLen = col.character_maximum_length ? \`(\${col.character_maximum_length})\` : '';
      console.log(\`  \${col.column_name}: \${col.data_type}\${maxLen} \${nullable}\`);
      if (col.column_default) {
        console.log(\`    DEFAULT: \${col.column_default}\`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela users:', error.message);
  }
}

checkUserTable();
"

echo
echo "5. Testando schema validation isoladamente:"
node -e "
const { z } = require('zod');

// Simular o schema que está sendo usado
const mockSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().default('user'),
  plan: z.string().default('free'),
  subscriptionStatus: z.string().default('active')
});

const testData = {
  email: 'test@example.com',
  password: 'test123456',
  name: 'Test User'
};

try {
  const result = mockSchema.parse(testData);
  console.log('✅ Schema validation OK:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('❌ Schema validation failed:', error.message);
}
"

echo
echo "=== Fim do Debug Detalhado ==="
echo
echo "PRÓXIMOS PASSOS:"
echo "1. Se tabelas estão faltando: npm run db:push"
echo "2. Se erro persiste: pm2 restart whatsflow"
echo "3. Para logs contínuos: pm2 logs whatsflow --follow"