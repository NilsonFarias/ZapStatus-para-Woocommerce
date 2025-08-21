#!/bin/bash

# Script para diagnosticar problemas de registro
# Versão detalhada com logs completos

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "=== DIAGNÓSTICO COMPLETO DO SISTEMA ==="

# 1. Verificar status da aplicação
print_status "1. Status da aplicação PM2:"
sudo -u whatsflow pm2 status

# 2. Verificar logs de erro recentes
print_status "2. Últimos erros da aplicação:"
sudo -u whatsflow pm2 logs whatsflow --lines 20 --err

# 3. Verificar configuração do .env
print_status "3. Configuração atual do .env:"
sudo -u whatsflow cat /home/whatsflow/ZapStatus-para-Woocommerce/.env

# 4. Testar conexão com banco de dados
print_status "4. Testando conexão PostgreSQL:"
sudo -u postgres psql -c "SELECT version();" whatsflow_db 2>/dev/null || echo "Erro na conexão com banco"

# 5. Verificar tabelas do banco
print_status "5. Tabelas existentes no banco:"
sudo -u postgres psql whatsflow_db -c "\dt" 2>/dev/null || echo "Erro ao listar tabelas"

# 6. Verificar se tabela users existe e estrutura
print_status "6. Estrutura da tabela users:"
sudo -u postgres psql whatsflow_db -c "\d users" 2>/dev/null || echo "Tabela users não encontrada"

# 7. Testar endpoint de registro via curl
print_status "7. Testando endpoint de registro localmente:"
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "company": "Test Company",
    "phone": "1234567890",
    "plan": "free"
  }' -v 2>&1 || echo "Erro na requisição local"

# 8. Verificar status do Nginx
print_status "8. Status do Nginx:"
sudo systemctl status nginx --no-pager -l

# 9. Verificar certificados SSL
print_status "9. Certificados SSL:"
sudo certbot certificates 2>/dev/null || echo "Erro ao verificar certificados"

# 10. Verificar logs do Nginx
print_status "10. Logs recentes do Nginx:"
sudo tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Sem logs de erro do Nginx"

# 11. Testar aplicação via HTTPS
print_status "11. Testando HTTPS externamente:"
curl -k -I https://mylist.center/ 2>/dev/null | head -5 || echo "Erro no acesso HTTPS"

# 12. Verificar processos Node.js
print_status "12. Processos Node.js ativos:"
ps aux | grep node

print_status "=== DIAGNÓSTICO COMPLETO ==="