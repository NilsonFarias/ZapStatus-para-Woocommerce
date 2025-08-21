#!/bin/bash

# Script para corrigir configuração SSL e domínio
# Corrige o problema do certificado mylist.center vs localhost

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "Fixing SSL and domain configuration..."

# 1. Corrigir configuração Nginx
print_status "Updating Nginx configuration..."
sudo tee /etc/nginx/sites-available/whatsflow > /dev/null << 'EOF'
server {
    listen 80;
    server_name mylist.center www.mylist.center;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mylist.center www.mylist.center;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/mylist.center/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mylist.center/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
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

# 2. Testar configuração Nginx
print_status "Testing Nginx configuration..."
sudo nginx -t
if [ $? -eq 0 ]; then
    print_success "Nginx configuration is valid"
    sudo systemctl reload nginx
    print_success "Nginx reloaded"
else
    print_error "Nginx configuration error"
    exit 1
fi

# 3. Atualizar .env para usar domínio correto
print_status "Updating .env configuration..."
cd /home/whatsflow/ZapStatus-para-Woocommerce

# Backup do .env atual
sudo -u whatsflow cp .env .env.backup.$(date +%s)

# Corrigir variáveis de ambiente
sudo -u whatsflow sed -i 's/localhost/mylist.center/g' .env

# Adicionar variável de domínio se não existir
if ! grep -q "DOMAIN=" .env; then
    echo "DOMAIN=mylist.center" | sudo -u whatsflow tee -a .env > /dev/null
fi

# Adicionar URL base se não existir
if ! grep -q "BASE_URL=" .env; then
    echo "BASE_URL=https://mylist.center" | sudo -u whatsflow tee -a .env > /dev/null
fi

print_status "Updated .env file:"
sudo -u whatsflow cat .env

# 4. Reiniciar aplicação
print_status "Restarting WhatsFlow application..."
sudo -u whatsflow pm2 restart whatsflow

# Aguardar inicialização
sleep 5

# 5. Verificar status
print_status "Checking application status..."
sudo -u whatsflow pm2 status

# 6. Testar conectividade
print_status "Testing HTTPS connectivity..."
curl -I https://mylist.center/ 2>/dev/null | head -n 1

print_success "SSL and domain configuration fixed!"
print_status "Application should now be accessible at: https://mylist.center"
print_status "Check logs with: sudo -u whatsflow pm2 logs whatsflow"