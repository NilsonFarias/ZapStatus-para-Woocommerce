#!/bin/bash

# Script para verificar e criar tabela de sessões se necessário
# Execute na VPS como: sudo -u whatsflow bash check-session-table.sh

echo "=== Verificação da Tabela de Sessões ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

# Carregar variáveis de ambiente
source .env

echo "1. Verificando se tabela sessions existe..."

# Usar node para testar conexão e verificar tabela sessions
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function checkSessions() {
  try {
    // Verificar se tabela sessions existe
    const tables = await sql\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'sessions'
    \`;
    
    if (tables.length === 0) {
      console.log('❌ Tabela sessions NÃO EXISTE');
      console.log('🔧 Criando tabela sessions...');
      
      // Criar tabela sessions
      await sql\`
        CREATE TABLE sessions (
          sid VARCHAR(36) PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      \`;
      
      // Criar índice para expiração
      await sql\`CREATE INDEX sessions_expire_idx ON sessions (expire)\`;
      
      console.log('✅ Tabela sessions criada com sucesso');
    } else {
      console.log('✅ Tabela sessions existe');
      
      // Verificar estrutura
      const columns = await sql\`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sessions'
        ORDER BY ordinal_position
      \`;
      
      console.log('📋 Estrutura da tabela sessions:');
      columns.forEach(col => {
        console.log(\`  - \${col.column_name}: \${col.data_type}\`);
      });
    }
    
    // Verificar se há sessões ativas
    const sessionCount = await sql\`SELECT COUNT(*) as count FROM sessions\`;
    console.log(\`📊 Sessões ativas: \${sessionCount[0].count}\`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkSessions();
"

echo
echo "2. Executando migrações do banco para garantir estrutura atualizada..."
npm run db:push

echo
echo "3. Reiniciando aplicação para aplicar mudanças..."
pm2 restart whatsflow

echo
echo "=== Verificação Concluída ==="
echo "Aguarde 10 segundos e teste o registro novamente"