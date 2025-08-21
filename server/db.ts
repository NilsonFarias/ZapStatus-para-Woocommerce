import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket to ignore SSL certificate errors globally
const WebSocketWithIgnoreSSL = class extends ws {
  constructor(address: string | URL, protocols?: string | string[], options?: ws.ClientOptions) {
    // Force SSL to be ignored for all connections in development/production with SSL issues
    const wsOptions = { 
      ...options, 
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined 
    };
    super(address, protocols, wsOptions);
  }
};

neonConfig.webSocketConstructor = WebSocketWithIgnoreSSL;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });