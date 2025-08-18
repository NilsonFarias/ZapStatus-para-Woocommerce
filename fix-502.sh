#!/bin/bash

# Script para corrigir erro 502 - WhatsFlow
# Execute no seu servidor VPS como root

echo "=== CORRIGINDO ERRO 502 WHATSFLOW ==="

# Parar aplicação atual
echo "1. Parando aplicação atual..."
sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true
sudo -u whatsflow pm2 kill 2>/dev/null || true

# Verificar se diretório existe
if [[ ! -d "/home/whatsflow/ZapStatus-para-Woocommerce" ]]; then
    echo "❌ Diretório da aplicação não encontrado"
    exit 1
fi

# Entrar no diretório da aplicação
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Verificar arquivo .env
if [[ ! -f .env ]]; then
    echo "2. Criando arquivo .env..."
    sudo -u whatsflow cp .env.example .env
    
    # Solicitar senha do banco
    echo -n "Senha do PostgreSQL para usuário whatsflow: "
    read -s DB_PASSWORD
    echo
    
    # Configurar .env
    sudo -u whatsflow sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://whatsflow:$DB_PASSWORD@localhost:5432/whatsflow|" .env
    
    # Gerar SESSION_SECRET
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    sudo -u whatsflow sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
fi

# Verificar dependências
echo "3. Verificando dependências..."
sudo -u whatsflow npm ci

# Build da aplicação
echo "4. Fazendo build..."
sudo -u whatsflow npm run build

# Verificar se PostgreSQL está rodando
echo "5. Verificando PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Testar conexão com banco
echo "6. Testando conexão com banco..."
sudo -u whatsflow node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.log('❌ Erro no banco:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Banco conectado');
        process.exit(0);
    }
});
" 2>/dev/null || {
    echo "❌ Erro na conexão com banco. Verifique DATABASE_URL no .env"
    exit 1
}

# Iniciar aplicação
echo "7. Iniciando aplicação..."
sudo -u whatsflow pm2 start npm --name "whatsflow" -- start

# Aguardar alguns segundos
sleep 5

# Verificar se está rodando
echo "8. Verificando aplicação..."
if sudo netstat -tlnp | grep :5000 > /dev/null; then
    echo "✅ Aplicação rodando na porta 5000"
else
    echo "❌ Aplicação não está na porta 5000"
    echo "Logs do PM2:"
    sudo -u whatsflow pm2 logs whatsflow --lines 10
    exit 1
fi

# Configurar auto-start
echo "9. Configurando auto-start..."
STARTUP_CMD=$(sudo -u whatsflow pm2 startup systemd -u whatsflow --hp /home/whatsflow 2>&1 | grep "sudo env" | head -1)
if [[ -n "$STARTUP_CMD" ]]; then
    eval "$STARTUP_CMD"
    sudo -u whatsflow pm2 save
fi

# Reiniciar Nginx
echo "10. Reiniciando Nginx..."
sudo systemctl restart nginx

# Teste final
echo "11. Teste final..."
sleep 3
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|404\|302"; then
    echo "✅ Aplicação respondendo"
    echo "✅ Tente acessar: https://mylist.center"
else
    echo "❌ Aplicação não responde"
    echo "Logs finais:"
    sudo -u whatsflow pm2 logs whatsflow --lines 5
fi

echo "=== CORREÇÃO CONCLUÍDA ==="