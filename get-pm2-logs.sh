#!/bin/bash

# Script para capturar logs do PM2 na VPS
echo "=== Logs do PM2 - WhatsFlow ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

echo "1. Status atual do PM2:"
sudo -u whatsflow pm2 status

echo
echo "2. Últimos 50 logs da aplicação:"
sudo -u whatsflow pm2 logs whatsflow --lines 50 --nostream

echo
echo "3. Logs de erro específicos:"
sudo -u whatsflow pm2 logs whatsflow --err --lines 30 --nostream

echo
echo "=== Fim dos Logs ==="
echo "Para logs em tempo real: sudo -u whatsflow pm2 logs whatsflow --follow"