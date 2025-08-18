#!/bin/bash

# Script de Diagnóstico WhatsFlow
# Execute no seu servidor VPS

echo "=== DIAGNÓSTICO WHATSFLOW ==="
echo

# Verificar status do Nginx
echo "1. STATUS NGINX:"
sudo systemctl status nginx --no-pager -l
echo

# Verificar se aplicação está rodando na porta 5000
echo "2. PORTA 5000:"
sudo netstat -tlnp | grep :5000 || echo "❌ Nada rodando na porta 5000"
echo

# Verificar PM2 como usuário whatsflow
echo "3. STATUS PM2:"
sudo -u whatsflow pm2 status
echo

# Verificar logs do PM2
echo "4. LOGS PM2 (últimas 20 linhas):"
sudo -u whatsflow pm2 logs whatsflow --lines 20
echo

# Verificar configuração do Nginx
echo "5. CONFIGURAÇÃO NGINX:"
sudo nginx -t
echo

# Verificar logs do Nginx
echo "6. LOGS NGINX (últimas 10 linhas):"
sudo tail -10 /var/log/nginx/error.log
echo

# Verificar se arquivo .env existe
echo "7. ARQUIVO .ENV:"
sudo -u whatsflow ls -la /home/whatsflow/ZapStatus-para-Woocommerce/.env
echo

# Verificar processo Node.js
echo "8. PROCESSOS NODE:"
ps aux | grep node | grep -v grep
echo

# Verificar se PostgreSQL está rodando
echo "9. POSTGRESQL:"
sudo systemctl status postgresql --no-pager -l
echo

echo "=== FIM DO DIAGNÓSTICO ==="