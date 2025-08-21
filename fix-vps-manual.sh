#!/bin/bash

# CORREÇÃO MANUAL PARA VPS - APLICAR DEPOIS DO SCRIPT DE INSTALAÇÃO
# Execução: curl -fsSL https://raw.githubusercontent.com/SeuUsuario/SeuRepo/main/fix-vps-manual.sh | bash

echo "🔧 APLICANDO CORREÇÕES MANUAIS VPS"
echo "=================================="

cd /home/whatsflow/ZapStatus-para-Woocommerce

# 1. PARAR PM2
echo "🛑 Parando aplicação..."
sudo -u whatsflow pm2 stop whatsflow 2>/dev/null || true
sudo -u whatsflow pm2 delete whatsflow 2>/dev/null || true

# 2. CORRIGIR server/db.ts COMPLETAMENTE
echo "🔧 Corrigindo server/db.ts..."
sudo -u whatsflow tee server/db.ts > /dev/null << 'EOF'
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// CRITICAL VPS FIX: Completely disable WebSocket to prevent SSL errors
neonConfig.useSecureWebSocket = false;
neonConfig.webSocketConstructor = undefined;

// Additional SSL bypass configurations for VPS
neonConfig.webSocketTimeoutMs = 0;
if (typeof neonConfig.webSocketConstructor !== 'undefined') {
  delete neonConfig.webSocketConstructor;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10')
});
export const db = drizzle({ client: pool, schema });
EOF

# 3. CORRIGIR shared/schema.ts
echo "🔧 Corrigindo shared/schema.ts..."
sudo -u whatsflow sed -i '/export const insertUserSchema = createInsertSchema(users).omit({/,/});/c\
export const insertUserSchema = createInsertSchema(users).omit({\
  id: true,\
  createdAt: true,\
  updatedAt: true,\
  username: true,\
  stripeCustomerId: true,\
  stripeSubscriptionId: true,\
});' shared/schema.ts

# 4. REBUILD APLICAÇÃO
echo "🏗️ Reconstruindo aplicação..."
sudo -u whatsflow npm run build

# 5. REINICIAR PM2 LIMPO  
echo "🚀 Reiniciando aplicação..."
sudo -u whatsflow pm2 flush 2>/dev/null || true
sudo -u whatsflow pm2 start ecosystem.config.cjs

# 6. VERIFICAR STATUS
sleep 10
echo "📊 Status da aplicação:"
sudo -u whatsflow pm2 status

echo ""
echo "✅ CORREÇÃO MANUAL APLICADA!"
echo "📋 Aguarde 30 segundos e verifique os logs:"
echo "    sudo -u whatsflow pm2 logs whatsflow --lines 10"