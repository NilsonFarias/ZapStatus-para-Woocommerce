#!/bin/bash

# Diagnóstico específico do erro 502 Bad Gateway
# Execute como: bash diagnose-502.sh

echo "=== DIAGNÓSTICO ERRO 502 BAD GATEWAY ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

echo "1. Status da aplicação PM2:"
pm2 status

echo
echo "2. Verificando se porta 5000 está ocupada:"
netstat -tulnp | grep :5000 || echo "Porta 5000 livre"

echo
echo "3. Verificando arquivo .env:"
if [ -f .env ]; then
    echo "✅ Arquivo .env existe"
    echo "Tamanho: $(wc -c < .env) bytes"
    echo "Permissões: $(ls -la .env | awk '{print $1 " " $3 ":" $4}')"
    
    echo
    echo "Variáveis no arquivo (nomes apenas):"
    grep -E "^[A-Z_]+" .env | cut -d= -f1 | sort
    
    echo
    echo "Verificando formato das variáveis:"
    while IFS= read -r line; do
        if [[ $line =~ ^[A-Z_]+=.+ ]]; then
            var_name=$(echo "$line" | cut -d= -f1)
            echo "✅ $var_name"
        elif [[ $line =~ ^[[:space:]]*$ ]] || [[ $line =~ ^# ]]; then
            # Linha vazia ou comentário - OK
            continue
        else
            echo "❌ Linha malformada: $line"
        fi
    done < .env
else
    echo "❌ Arquivo .env NÃO existe!"
    exit 1
fi

echo
echo "4. Testando carregamento do .env com Node.js:"
cat > test_env.js << 'EOF'
require('dotenv').config();

console.log('=== Variáveis Carregadas ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'DEFINIDA' : 'NÃO DEFINIDA');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NÃO DEFINIDA');

if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL começa com postgres:', process.env.DATABASE_URL.startsWith('postgres'));
    console.log('Tamanho DATABASE_URL:', process.env.DATABASE_URL.length, 'caracteres');
}

// Testar conexão com banco
if (process.env.DATABASE_URL) {
    const { neon } = require('@neondatabase/serverless');
    
    (async () => {
        try {
            const sql = neon(process.env.DATABASE_URL);
            const result = await sql`SELECT 1 as test`;
            console.log('✅ Conexão com banco: OK');
        } catch (error) {
            console.log('❌ Conexão com banco: FALHOU');
            console.log('Erro:', error.message);
        }
    })();
} else {
    console.log('❌ Não foi possível testar banco - DATABASE_URL não definida');
}
EOF

node test_env.js
rm test_env.js

echo
echo "5. Verificando logs recentes do PM2:"
pm2 logs whatsflow --lines 20 --nostream

echo
echo "6. Testando resposta da aplicação:"
echo "Health check:"
curl -s -w "HTTP %{http_code}\n" http://localhost:5000/api/health || echo "Falhou"

echo
echo "API de autenticação:"
curl -s -w "HTTP %{http_code}\n" http://localhost:5000/api/auth/me || echo "Falhou"

echo
echo "=== STATUS DA APLICAÇÃO ==="
echo "PM2 Status:"
pm2 list | grep whatsflow || echo "whatsflow não encontrado no PM2"

echo
echo "Processo Node.js ativo:"
ps aux | grep "node.*whatsflow\|node.*dist/index.js" | grep -v grep || echo "Nenhum processo Node.js encontrado"

echo
echo "=== FIM DO DIAGNÓSTICO ==="
echo
echo "SOLUÇÕES POSSÍVEIS:"
echo "1. Se .env está OK mas variáveis não carregam: bash fix-502.sh"
echo "2. Se aplicação não inicia: pm2 restart whatsflow"
echo "3. Se erro persiste: pm2 delete whatsflow && pm2 start ecosystem.config.cjs"