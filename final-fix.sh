#!/bin/bash

# CORREÇÃO DEFINITIVA - Todos os Problemas
# Resolve: Banco local, SSL, Build, Admin creation

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "=== CORREÇÃO DEFINITIVA DO SISTEMA ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

# 1. CORRIGIR .ENV PARA USAR BANCO LOCAL
print_status "1. Corrigindo .env para usar PostgreSQL local..."

# Backup do .env atual
sudo -u whatsflow cp .env .env.backup.$(date +%s)

# Corrigir .env com configurações corretas
sudo -u whatsflow tee .env > /dev/null << EOF
# Database - LOCAL PostgreSQL
DATABASE_URL="postgresql://whatsflow_user:whatsflow_pass@localhost:5432/whatsflow_db"

# Session
SESSION_SECRET="$(openssl rand -base64 32)"

# Domain - CORRIGIDO
DOMAIN="mylist.center"
BASE_URL="https://mylist.center"

# Stripe (placeholders válidos)
STRIPE_SECRET_KEY="sk_test_placeholder_$(openssl rand -hex 24)"
VITE_STRIPE_PUBLIC_KEY="pk_test_placeholder_$(openssl rand -hex 24)"
STRIPE_BASIC_PRICE_ID="price_basic_placeholder"
STRIPE_PRO_PRICE_ID="price_pro_placeholder" 
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise_placeholder"

# Evolution API (placeholders)
EVOLUTION_API_KEY="placeholder_key"
EVOLUTION_API_URL="https://localhost/v2"
EOF

print_success ".env corrigido para banco local e domínio correto"

# 2. REBUILD DA APLICAÇÃO
print_status "2. Rebuilding aplicação..."
sudo -u whatsflow npm run build

print_success "Aplicação buildada"

# 3. APLICAR SCHEMA NO BANCO LOCAL
print_status "3. Aplicando schema no banco local..."
sudo -u whatsflow npm run db:push

if [ $? -eq 0 ]; then
    print_success "Schema aplicado com sucesso"
else
    print_error "Erro ao aplicar schema - continuando..."
fi

# 4. CRIAR USUÁRIO ADMIN DIRETAMENTE NO BANCO
print_status "4. Criando usuário admin diretamente no banco..."

# Gerar hash da senha admin123
ADMIN_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 12).then(h => console.log(h))")

# Inserir admin diretamente no banco
sudo -u postgres psql whatsflow_db << EOF || print_warning "Admin pode já existir"
-- Inserir usuário admin
INSERT INTO users (id, email, password, name, role, company, phone, plan, subscription_status, created_at, updated_at) 
VALUES (
  gen_random_uuid(),
  'admin@whatsflow.com',
  '$ADMIN_HASH',
  'Administrator',
  'admin',
  'WhatsFlow',
  '',
  'enterprise',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Inserir cliente para admin
INSERT INTO clients (id, user_id, name, email, plan, status, monthly_messages, last_access, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  u.id,
  'WhatsFlow Admin',
  'admin@whatsflow.com',
  'enterprise',
  'active',
  NULL,
  NOW(),
  NOW(),
  NOW()
FROM users u 
WHERE u.email = 'admin@whatsflow.com'
ON CONFLICT (email) DO NOTHING;

-- Verificar criação
SELECT 'Admin created:' as status, email, name, role FROM users WHERE email = 'admin@whatsflow.com';
EOF

print_success "Admin criado/verificado no banco"

# 5. CORRIGIR CONFIGURAÇÃO NGINX PARA SSL
print_status "5. Corrigindo configuração Nginx..."

sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << 'EOF'
server {
    listen 80;
    server_name mylist.center www.mylist.center;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mylist.center www.mylist.center;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/mylist.center/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mylist.center/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Testar e recarregar nginx
sudo nginx -t && sudo systemctl reload nginx
print_success "Nginx configurado e recarregado"

# 6. CORRIGIR ECOSYSTEM CONFIG PARA USAR VARIÁVEIS CORRETAS
print_status "6. Corrigindo PM2 ecosystem config..."

sudo -u whatsflow tee ecosystem.config.cjs > /dev/null << 'EOF'
module.exports = {
  apps: [{
    name: 'whatsflow',
    script: 'dist/index.js',
    cwd: '/home/whatsflow/ZapStatus-para-Woocommerce',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://whatsflow_user:whatsflow_pass@localhost:5432/whatsflow_db',
      DOMAIN: 'mylist.center',
      BASE_URL: 'https://mylist.center'
    },
    error_file: '/home/whatsflow/.pm2/logs/whatsflow-error.log',
    out_file: '/home/whatsflow/.pm2/logs/whatsflow-out.log',
    log_file: '/home/whatsflow/.pm2/logs/whatsflow.log',
    time: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
}
EOF

print_success "Ecosystem config atualizado"

# 7. REINICIAR APLICAÇÃO COM CONFIGURAÇÕES CORRETAS
print_status "7. Reiniciando aplicação..."
sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true
sudo -u whatsflow pm2 start ecosystem.config.cjs

# Aguardar inicialização
sleep 10

# 8. VERIFICAR STATUS FINAL
print_status "8. Verificando status final..."

# Verificar PM2
PM2_STATUS=$(sudo -u whatsflow pm2 list | grep whatsflow | grep -c "online" || echo "0")
if [ "$PM2_STATUS" -gt 0 ]; then
    print_success "Aplicação online no PM2"
else
    print_error "Aplicação não está online no PM2"
    sudo -u whatsflow pm2 logs whatsflow --lines 10
fi

# Testar endpoint local
LOCAL_TEST=$(curl -s -w "%{http_code}" http://localhost:5000/ 2>/dev/null | tail -c 3)
if [ "$LOCAL_TEST" = "200" ] || [ "$LOCAL_TEST" = "304" ]; then
    print_success "Aplicação respondendo localmente"
else
    print_warning "Aplicação não responde localmente - HTTP $LOCAL_TEST"
fi

# Testar HTTPS externo
HTTPS_TEST=$(curl -k -s -w "%{http_code}" https://mylist.center/ 2>/dev/null | tail -c 3)
if [ "$HTTPS_TEST" = "200" ] || [ "$HTTPS_TEST" = "304" ]; then
    print_success "HTTPS funcionando externamente"
else
    print_warning "HTTPS não funcionando - HTTP $HTTPS_TEST"
fi

# 9. TESTE FINAL DE REGISTRO
print_status "9. Testando registro final..."
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"

RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"test123456\", 
    \"name\": \"Test User\",
    \"company\": \"Test Company\",
    \"phone\": \"1234567890\",
    \"plan\": \"free\"
  }" 2>/dev/null || echo "000")

HTTP_CODE="${RESPONSE: -3}"

if [ "$HTTP_CODE" = "201" ]; then
    print_success "API de registro funcionando!"
    # Limpar usuário teste
    sudo -u postgres psql whatsflow_db -c "DELETE FROM clients WHERE email = '$TEST_EMAIL'; DELETE FROM users WHERE email = '$TEST_EMAIL';" >/dev/null 2>&1
else
    print_error "API de registro ainda com problemas - HTTP $HTTP_CODE"
fi

print_success "=== CORREÇÃO DEFINITIVA CONCLUÍDA ==="
print_status ""
print_status "🎯 TESTE FINAL:"
print_status "1. Acesse: https://mylist.center"
print_status "2. Login admin: admin@whatsflow.com / admin123"
print_status "3. Ou registre nova conta"
print_status ""
print_status "📊 Status:"
print_status "- Banco: PostgreSQL local"
print_status "- SSL: mylist.center certificate"
print_status "- Admin: Criado diretamente no banco"
print_status "- Build: Aplicação buildada"
print_status ""
print_status "Se ainda houver problemas:"
print_status "sudo -u whatsflow pm2 logs whatsflow --lines 20"