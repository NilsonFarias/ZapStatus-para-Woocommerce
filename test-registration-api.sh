#!/bin/bash

# Teste da API de Registro
# Testando registro com dados válidos

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "Teste da API de Registro"
print_status "========================"

# 1. Testar se aplicação está respondendo
print_status "Testando se aplicação está ativa..."
curl -s http://localhost:5000/api/health 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Aplicação respondendo"
else
    print_error "Aplicação não está respondendo"
fi

# 2. Testar registro com dados válidos
print_status "Testando registro de novo usuário..."

TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"

print_status "Email de teste: $TEST_EMAIL"

RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"test123456\",
    \"name\": \"Test User\",
    \"company\": \"Test Company\",
    \"phone\": \"1234567890\",
    \"plan\": \"free\"
  }")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

print_status "HTTP Code: $HTTP_CODE"
print_status "Response Body: $BODY"

if [ "$HTTP_CODE" = "201" ]; then
    print_success "Registro bem-sucedido"
else
    print_error "Falha no registro"
fi

# 3. Verificar logs de erro recentes
print_status "Logs de erro recentes:"
sudo -u whatsflow pm2 logs whatsflow --lines 5 --err

# 4. Verificar status do banco
print_status "Testando conexão com banco..."
sudo -u postgres psql whatsflow_db -c "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null || print_error "Erro na conexão com banco"

# 5. Verificar variáveis de ambiente críticas
print_status "Verificando variáveis de ambiente:"
cd /home/whatsflow/ZapStatus-para-Woocommerce
grep -E "(DATABASE_URL|SESSION_SECRET)" .env || print_error "Variáveis críticas ausentes"