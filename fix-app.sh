#!/bin/bash
# Script para corrigir aplicação que não consegue iniciar na porta 5000

echo "=== CORRIGINDO APLICAÇÃO QUE NÃO INICIA ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

# 1. Parar PM2 completamente
echo "1. Parando PM2..."
pm2 delete all 2>/dev/null || true
pm2 kill

# 2. Verificar se .env existe e tem DATABASE_URL
echo "2. Verificando .env..."
if [ ! -f .env ]; then
    echo "ERRO: .env não encontrado. Criando..."
    cp .env.example .env
    # Configurar DATABASE_URL
    read -p "Senha do PostgreSQL: " DB_PASSWORD
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
    # Gerar SESSION_SECRET
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
fi

echo "Conteúdo do .env:"
cat .env

# 3. Testar se aplicação compila
echo "3. Verificando build..."
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "Rebuild necessário..."
    npm run build
fi

# 4. Verificar se consegue conectar no banco
echo "4. Testando conexão com banco..."
sudo -u postgres psql -c "\l" | grep whatsflow
if [ $? -ne 0 ]; then
    echo "ERRO: Banco whatsflow não encontrado!"
    echo "Criando banco..."
    sudo -u postgres createdb whatsflow
    sudo -u postgres psql -c "CREATE USER whatsflow WITH ENCRYPTED PASSWORD 'JPN@22zk76';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;"
fi

# 5. Executar migrações do banco
echo "5. Executando migrações do banco..."
npm run db:push

# 6. Testar aplicação manualmente primeiro
echo "6. Testando aplicação manualmente..."
echo "Executando: NODE_ENV=production node dist/index.js"

# Executar por 10 segundos para ver se inicia
NODE_ENV=production timeout 10 node dist/index.js &
PID=$!
sleep 5

# Verificar se processo ainda está rodando
if kill -0 $PID 2>/dev/null; then
    echo "✅ Aplicação iniciou com sucesso manualmente"
    kill $PID
    
    # 5. Iniciar com PM2 usando ecosystem.config.cjs
    echo "5. Iniciando com PM2..."
    if [ ! -f ecosystem.config.cjs ]; then
        echo "Criando ecosystem.config.cjs..."
        cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'npm',
    args: 'start',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 5
  }]
};
EOF
    fi
    
    pm2 start ecosystem.config.cjs
    sleep 10
    
    # Verificar se está rodando
    if pm2 list | grep -q "whatsflow.*online"; then
        echo "✅ PM2 iniciado com sucesso"
        
        # Testar porta 5000
        sleep 5
        if curl -s http://localhost:5000 > /dev/null; then
            echo "✅ Aplicação respondendo na porta 5000"
            pm2 save
        else
            echo "❌ Aplicação não responde na porta 5000"
            pm2 logs whatsflow --lines 10 --nostream
        fi
    else
        echo "❌ PM2 falhou ao iniciar"
        pm2 logs whatsflow --lines 20 --nostream
    fi
else
    echo "❌ Aplicação falhou ao iniciar manualmente"
    echo "Verificando logs de erro..."
    wait $PID
fi

echo "Status final:"
pm2 list
netstat -tlnp | grep :5000 || echo "Porta 5000 não está em uso"