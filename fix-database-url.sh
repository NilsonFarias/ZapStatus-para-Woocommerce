#!/bin/bash

# Script para corrigir DATABASE_URL - WhatsFlow
# Execute no seu servidor VPS

echo "=== CORRIGINDO DATABASE_URL ==="

# Parar aplicação
echo "1. Parando aplicação..."
sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true

# Ir para diretório da aplicação
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Verificar se .env existe
echo "2. Verificando arquivo .env..."
if [[ ! -f .env ]]; then
    echo "❌ Arquivo .env não existe. Criando..."
    sudo -u whatsflow cp .env.example .env
fi

# Mostrar conteúdo atual do .env
echo "3. Conteúdo atual do .env:"
sudo -u whatsflow cat .env | grep -E "(DATABASE_URL|SESSION_SECRET)" || echo "❌ Variáveis não encontradas"

# Solicitar senha do banco
echo
echo -n "Digite a senha do PostgreSQL para usuário 'whatsflow': "
read -s DB_PASSWORD
echo

# Configurar DATABASE_URL
echo "4. Configurando DATABASE_URL..."
sudo -u whatsflow sed -i '/^DATABASE_URL=/d' .env
echo "DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow" | sudo -u whatsflow tee -a .env

# Gerar SESSION_SECRET se não existir
if ! sudo -u whatsflow grep -q "^SESSION_SECRET=" .env; then
    echo "5. Gerando SESSION_SECRET..."
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    echo "SESSION_SECRET=$SESSION_SECRET" | sudo -u whatsflow tee -a .env
fi

# Testar conexão com banco
echo "6. Testando conexão com PostgreSQL..."
if sudo -u postgres psql -c "SELECT 1;" whatsflow > /dev/null 2>&1; then
    echo "✅ PostgreSQL acessível"
else
    echo "❌ Erro no PostgreSQL. Reiniciando serviço..."
    sudo systemctl restart postgresql
    sleep 3
fi

# Verificar se usuário e banco existem
echo "7. Verificando usuário e banco..."
sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='whatsflow';" | grep -q 1 || {
    echo "❌ Usuário whatsflow não existe no PostgreSQL"
    echo "Criando usuário..."
    sudo -u postgres psql -c "CREATE USER whatsflow WITH PASSWORD '$DB_PASSWORD';"
}

sudo -u postgres psql -t -c "SELECT 1 FROM pg_database WHERE datname='whatsflow';" | grep -q 1 || {
    echo "❌ Banco whatsflow não existe"
    echo "Criando banco..."
    sudo -u postgres psql -c "CREATE DATABASE whatsflow;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;"
}

# Testar DATABASE_URL diretamente
echo "8. Testando DATABASE_URL..."
DATABASE_URL="postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow"
if sudo -u whatsflow psql "$DATABASE_URL" -c "SELECT NOW();" > /dev/null 2>&1; then
    echo "✅ DATABASE_URL funcional"
else
    echo "❌ DATABASE_URL com problema"
    exit 1
fi

# Verificar conteúdo final do .env
echo "9. Arquivo .env atualizado:"
sudo -u whatsflow cat .env | grep -E "(DATABASE_URL|SESSION_SECRET)"

# Executar migrações se necessário
echo "10. Executando migrações..."
sudo -u whatsflow npm run db:migrate 2>/dev/null || echo "⚠️ Migrações não executadas (comando pode não existir)"

# Rebuild da aplicação
echo "11. Fazendo rebuild..."
sudo -u whatsflow npm run build

# Reiniciar aplicação
echo "12. Iniciando aplicação..."
sudo -u whatsflow pm2 start npm --name "whatsflow" -- start

# Aguardar inicialização
sleep 5

# Verificar se iniciou corretamente
echo "13. Verificando aplicação..."
if sudo -u whatsflow pm2 logs whatsflow --lines 3 | grep -q "serving on port"; then
    echo "✅ Aplicação iniciada com sucesso!"
else
    echo "❌ Aplicação com problema. Logs:"
    sudo -u whatsflow pm2 logs whatsflow --lines 10
fi

echo "=== CORREÇÃO CONCLUÍDA ==="