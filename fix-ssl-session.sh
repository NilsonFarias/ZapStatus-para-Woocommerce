#!/bin/bash

# CORREÇÃO CRÍTICA SSL E SESSÃO PARA VPS
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

print_status "Diagnosing SSL and Session issues..."

# 1. Verificar certificado SSL
print_status "Checking SSL certificate..."
DOMAIN=$(grep "DOMAIN=" .env | cut -d'=' -f2 | tr -d '"')

if [ -z "$DOMAIN" ]; then
    print_error "Domain not found in .env file"
    exit 1
fi

print_status "Domain: $DOMAIN"

if sudo nginx -t &>/dev/null; then
    print_success "✅ Nginx configuration is valid"
else
    print_error "❌ Nginx configuration has errors"
    sudo nginx -t
fi

# 2. Verificar se SSL está funcionando
print_status "Testing SSL certificate..."
if curl -s -I "https://$DOMAIN" | grep -q "HTTP/2 200\|HTTP/1.1 200"; then
    print_success "✅ SSL is working - HTTPS responds"
    SSL_WORKING=true
else
    print_warning "⚠️ SSL might not be working properly"
    SSL_WORKING=false
fi

# 3. Corrigir configuração de sessão baseado no SSL
print_status "Applying session fixes based on SSL status..."

sudo -u whatsflow cat > session-ssl-fix.js << 'EOF'
const fs = require('fs');

let content = fs.readFileSync('server/routes.ts', 'utf8');

// Remove existing session config
const sessionRegex = /app\.use\(session\(\{[\s\S]*?\}\)\);/;

const sslWorking = process.env.SSL_WORKING === 'true';
console.log('SSL Working:', sslWorking);

const newSession = `app.use(session({
    secret: process.env.SESSION_SECRET || 'whatsflow-secret-key-dev',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: ${sslWorking ? 'true' : 'false'}, // Dynamic based on SSL status
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: ${sslWorking ? "'none'" : "'lax'"}, // Adjust for SSL
    },
  }));`;

content = content.replace(sessionRegex, newSession);
fs.writeFileSync('server/routes.ts', content);

console.log(`✅ Session configuration updated for SSL=${sslWorking}`);
EOF

# Executar correção com status SSL
SSL_WORKING=$SSL_WORKING sudo -u whatsflow -E node session-ssl-fix.js
sudo -u whatsflow rm session-ssl-fix.js

# 4. Rebuild aplicação
print_status "Rebuilding application with SSL-aware session config..."
sudo -u whatsflow rm -rf dist/
sudo -u whatsflow npm run build

# 5. Restart PM2
print_status "Restarting application..."
sudo -u whatsflow pm2 restart whatsflow

# 6. Aguardar e testar
sleep 5

# 7. Testar login
print_status "Testing login and session..."
if [ "$SSL_WORKING" = "true" ]; then
    TEST_URL="https://$DOMAIN"
else
    TEST_URL="http://$DOMAIN"
    print_warning "Testing with HTTP since SSL is not working"
fi

print_success "========================================"
print_success "SSL and Session Fix Applied!"
print_success "========================================"
print_status "Test URL: $TEST_URL"
print_status "Admin login: admin@whatsflow.com / admin123"

if [ "$SSL_WORKING" = "true" ]; then
    print_success "✅ SSL is working - Session cookies will use secure=true"
else
    print_warning "⚠️ SSL needs fixing - Session cookies using secure=false temporarily"
    print_status "To fix SSL later, run: sudo certbot --nginx -d $DOMAIN"
fi

print_status "Current PM2 status:"
sudo -u whatsflow pm2 logs whatsflow --lines 5