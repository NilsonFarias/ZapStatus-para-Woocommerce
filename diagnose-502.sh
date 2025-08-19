#!/bin/bash
# Script para diagnosticar erro 502 Bad Gateway

echo "=== DIAGNÓSTICO ERRO 502 BAD GATEWAY ==="
echo

echo "1. Status da aplicação PM2:"
pm2 list
echo

echo "2. Status da porta 5000:"
sudo netstat -tlnp | grep :5000 || echo "ERRO: Porta 5000 não está em uso"
echo

echo "3. Status do Nginx:"
sudo systemctl status nginx --no-pager -l
echo

echo "4. Teste de conectividade local:"
curl -v http://localhost:5000 2>&1 | head -20 || echo "ERRO: Não consegue conectar na porta 5000"
echo

echo "5. Logs do Nginx (últimas 20 linhas):"
sudo tail -20 /var/log/nginx/error.log
echo

echo "6. Logs da aplicação PM2 (últimas 20 linhas):"
pm2 logs whatsflow --lines 20 --nostream
echo

echo "7. Configuração Nginx ativa:"
if [ -f /etc/nginx/sites-enabled/whatsflow ]; then
    echo "=== /etc/nginx/sites-enabled/whatsflow ==="
    sudo cat /etc/nginx/sites-enabled/whatsflow
elif [ -f /etc/nginx/conf.d/whatsflow.conf ]; then
    echo "=== /etc/nginx/conf.d/whatsflow.conf ==="
    sudo cat /etc/nginx/conf.d/whatsflow.conf
else
    echo "ERRO: Configuração Nginx não encontrada"
fi
echo

echo "8. Teste de sintaxe Nginx:"
sudo nginx -t
echo

echo "=== SOLUÇÕES POSSÍVEIS ==="
echo "Se porta 5000 não estiver ativa:"
echo "  cd /home/whatsflow/ZapStatus-para-Woocommerce"
echo "  pm2 restart whatsflow"
echo
echo "Se Nginx tiver erro de configuração:"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
echo