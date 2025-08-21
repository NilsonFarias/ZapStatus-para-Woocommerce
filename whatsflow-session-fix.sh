#!/bin/bash

# CORREÇÃO CRÍTICA DE SESSÃO PARA VPS
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_status "Applying session fixes for VPS production..."

cd /home/whatsflow/ZapStatus-para-Woocommerce || exit 1

# 1. Backup do arquivo original
sudo -u whatsflow cp server/routes.ts server/routes.ts.backup

# 2. Adicionar import do connect-pg-simple
if ! grep -q "connect-pg-simple" server/routes.ts; then
    sudo -u whatsflow sed -i '/import session from "express-session";/a import connectPgSimple from "connect-pg-simple";' server/routes.ts
    print_success "✅ Added connect-pg-simple import"
fi

# 3. Corrigir configuração de sessão para usar PostgreSQL store
sudo -u whatsflow sed -i '/export async function registerRoutes/,/app\.use(session({/ {
    /app\.use(session({/i\
  // Session store configuration\
  const PgSession = connectPgSimple(session);\
  const sessionStore = new PgSession({\
    conString: process.env.DATABASE_URL,\
    createTableIfMissing: true,\
    tableName: '\''sessions'\'',\
  });\

}' server/routes.ts

# 4. Atualizar configuração do cookie para produção
sudo -u whatsflow sed -i 's/secure: false,/secure: process.env.NODE_ENV === '\''production'\'',/' server/routes.ts
sudo -u whatsflow sed -i '/saveUninitialized: false,/a\    store: sessionStore,' server/routes.ts

# 5. Rebuild da aplicação com as correções
print_status "Rebuilding application with session fixes..."
sudo -u whatsflow rm -rf dist/
sudo -u whatsflow npm run build

# 6. Restart do PM2
print_status "Restarting application..."
sudo -u whatsflow pm2 restart whatsflow

print_success "Session fixes applied! Try logging in again."
print_status "Check logs: sudo -u whatsflow pm2 logs whatsflow --lines 20"