#!/bin/bash
# Script para corrigir erro 502 Bad Gateway

echo "=== CORRIGINDO ERRO 502 BAD GATEWAY ==="

# Ir para diretório da aplicação
cd /home/whatsflow/ZapStatus-para-Woocommerce

# 1. Verificar se aplicação está rodando
echo "1. Verificando status PM2..."
pm2 list

# 2. Parar e reiniciar aplicação
echo "2. Reiniciando aplicação..."
pm2 delete whatsflow 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 3. Verificar se porta 5000 está ativa
echo "3. Aguardando aplicação inicializar..."
sleep 10

echo "4. Testando conectividade local..."
if curl -s http://localhost:5000 > /dev/null; then
    echo "✅ Aplicação respondendo na porta 5000"
else
    echo "❌ Aplicação NÃO está respondendo na porta 5000"
    echo "Verificando logs..."
    pm2 logs whatsflow --lines 10 --nostream
fi

# 4. Testar Nginx
echo "5. Testando configuração Nginx..."
if sudo nginx -t; then
    echo "✅ Configuração Nginx OK"
    sudo systemctl reload nginx
    echo "✅ Nginx recarregado"
else
    echo "❌ Erro na configuração Nginx"
    sudo nginx -t
fi

# 5. Verificar firewall
echo "6. Verificando firewall..."
if command -v ufw >/dev/null 2>&1; then
    sudo ufw status | grep -E "(80|443|5000)"
    echo "Liberando portas no UFW..."
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw allow 5000
elif command -v firewall-cmd >/dev/null 2>&1; then
    sudo firewall-cmd --list-ports
    echo "Liberando portas no Firewall..."
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp  
    sudo firewall-cmd --permanent --add-port=5000/tcp
    sudo firewall-cmd --reload
fi

echo "7. Status final:"
pm2 list
sudo systemctl status nginx --no-pager

echo
echo "Teste agora: https://mylist.center"
echo
echo "Se ainda houver erro 502, execute:"
echo "  bash diagnose-502.sh"