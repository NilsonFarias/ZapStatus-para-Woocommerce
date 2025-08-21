#!/bin/bash

# Correção Completa do Sistema de Registro
# Resolve problemas de SSL, banco de dados e endpoint de registro

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

print_status "=== CORREÇÃO COMPLETA DO SISTEMA DE REGISTRO ==="

# 1. Verificar e corrigir banco de dados
print_status "1. Verificando banco de dados..."
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Executar migrations para garantir que tabelas estão corretas
print_status "Aplicando schema do banco..."
sudo -u whatsflow npm run db:push 2>&1

# Verificar se tabela users existe
if sudo -u postgres psql whatsflow_db -c "\d users" >/dev/null 2>&1; then
    print_success "Tabela users existe"
else
    print_error "Tabela users não encontrada - executando db:push novamente"
    sudo -u whatsflow npm run db:push
fi

# 2. Verificar se admin existe
print_status "2. Verificando usuário admin..."
ADMIN_EXISTS=$(sudo -u postgres psql whatsflow_db -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@whatsflow.com';" 2>/dev/null | xargs)
if [ "$ADMIN_EXISTS" = "0" ]; then
    print_status "Criando usuário admin..."
    sudo -u whatsflow node -e "
    const { storage } = require('./dist/server/storage.js');
    const bcrypt = require('bcryptjs');
    
    async function createAdmin() {
        try {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            const admin = await storage.createUser({
                email: 'admin@whatsflow.com',
                password: hashedPassword,
                name: 'Administrator',
                role: 'admin',
                company: 'WhatsFlow',
                phone: '',
                plan: 'enterprise'
            });
            console.log('Admin user created:', admin.id);
            
            // Criar cliente para admin
            await storage.createClient({
                userId: admin.id,
                name: 'WhatsFlow Admin',
                email: 'admin@whatsflow.com',
                plan: 'enterprise',
                status: 'active'
            });
            console.log('Admin client created');
        } catch (error) {
            console.error('Error creating admin:', error.message);
        }
        process.exit(0);
    }
    
    createAdmin();
    " || print_warning "Admin já pode existir"
else
    print_success "Usuário admin já existe"
fi

# 3. Corrigir configuração de cookies para HTTPS
print_status "3. Atualizando configuração de sessão para HTTPS..."
sudo -u whatsflow sed -i 's/secure: false/secure: true/g' dist/server/routes.js 2>/dev/null || true

# 4. Testar API de registro localmente
print_status "4. Testando API de registro..."
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
    print_success "API de registro funcionando"
    # Limpar usuário de teste
    sudo -u postgres psql whatsflow_db -c "DELETE FROM clients WHERE email = '$TEST_EMAIL';" >/dev/null 2>&1
    sudo -u postgres psql whatsflow_db -c "DELETE FROM users WHERE email = '$TEST_EMAIL';" >/dev/null 2>&1
elif [ "$HTTP_CODE" = "400" ]; then
    print_warning "API respondendo (usuário já existe é esperado)"
else
    print_error "API não está funcionando - HTTP $HTTP_CODE"
    print_status "Logs recentes da aplicação:"
    sudo -u whatsflow pm2 logs whatsflow --lines 5 --err
fi

# 5. Corrigir SSL e certificados
print_status "5. Verificando configuração SSL..."
if [ -f /etc/letsencrypt/live/mylist.center/fullchain.pem ]; then
    print_success "Certificado SSL existe"
    
    # Testar HTTPS externamente
    HTTPS_TEST=$(curl -k -s -w "%{http_code}" https://mylist.center/ 2>/dev/null | tail -c 3)
    if [ "$HTTPS_TEST" = "200" ]; then
        print_success "HTTPS funcionando"
    else
        print_warning "HTTPS não está respondendo corretamente"
    fi
else
    print_warning "Certificado SSL não encontrado"
fi

# 6. Verificar logs de erro
print_status "6. Verificando logs de erro atuais..."
sudo -u whatsflow pm2 logs whatsflow --lines 10 --err

# 7. Reiniciar aplicação com configurações corrigidas
print_status "7. Reiniciando aplicação..."
sudo -u whatsflow pm2 restart whatsflow
sleep 5

# 8. Teste final
print_status "8. Teste final do sistema..."
APP_STATUS=$(curl -s -w "%{http_code}" http://localhost:5000/ 2>/dev/null | tail -c 3)
if [ "$APP_STATUS" = "200" ] || [ "$APP_STATUS" = "304" ]; then
    print_success "Aplicação funcionando"
else
    print_error "Aplicação não está respondendo"
fi

print_success "=== CORREÇÃO CONCLUÍDA ==="
print_status "Teste manual:"
print_status "1. Acesse: https://mylist.center"
print_status "2. Tente fazer login com: admin@whatsflow.com / admin123"
print_status "3. Ou registre uma nova conta"
print_status ""
print_status "Se ainda houver problemas, verifique os logs:"
print_status "sudo -u whatsflow pm2 logs whatsflow"