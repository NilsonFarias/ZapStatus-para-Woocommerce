#!/bin/bash

# Script para testar API de registro com dados válidos
# Execute na VPS para verificar se o endpoint está funcionando

echo "=== Teste da API de Registro ==="

API_URL="http://localhost:5000"
TEST_EMAIL="teste$(date +%s)@example.com"

echo "Testando registro com email: $TEST_EMAIL"
echo

# Teste 1: Registro com dados completos
echo "1. Tentando registro com dados completos:"
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"senha123456\",
    \"name\": \"Usuário Teste\",
    \"company\": \"Empresa Teste\",
    \"phone\": \"11999999999\"
  }" \
  -w "\nStatus HTTP: %{http_code}\n\n" \
  -v

echo "----------------------------------------"

# Teste 2: Registro com dados mínimos
TEST_EMAIL2="teste$(date +%s)b@example.com"
echo "2. Tentando registro com dados mínimos:"
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL2\",
    \"password\": \"senha123456\",
    \"name\": \"Usuário Mínimo\"
  }" \
  -w "\nStatus HTTP: %{http_code}\n\n" \
  -v

echo "----------------------------------------"

# Teste 3: Verificar health check
echo "3. Verificando health check:"
curl "$API_URL/api/health" \
  -w "\nStatus HTTP: %{http_code}\n\n"

echo "=== Fim dos Testes ==="
echo "Verifique os logs em tempo real com: sudo -u whatsflow pm2 logs whatsflow --follow"