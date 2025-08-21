#!/bin/bash

# CORREÇÃO FINAL VPS - Execute EXATAMENTE estes comandos na sua VPS
# Copia e cola linha por linha no terminal da VPS

echo "=== CORREÇÃO FINAL WEBSOCKET VPS ==="

cd /home/whatsflow/ZapStatus-para-Woocommerce

# 1. Parar aplicação
sudo -u whatsflow pm2 stop all
sudo -u whatsflow pm2 delete all

# 2. Substituir server/db.ts completamente
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

# 3. Rebuild OBRIGATÓRIO após mudança
sudo -u whatsflow npm run build

# 4. Restart limpo
sudo -u whatsflow pm2 flush
sudo -u whatsflow pm2 start ecosystem.config.cjs

echo "=== CORREÇÃO APLICADA - Aguarde 30 segundos ==="
sleep 10
sudo -u whatsflow pm2 status