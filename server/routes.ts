import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import axios from "axios";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import session from "express-session";
import { storage } from "./storage";
import { evolutionApi } from "./services/evolutionApi";
import { messageQueue, MessageQueueService } from "./services/messageQueue";

const messageQueueService = new MessageQueueService();
import { insertClientSchema, insertInstanceSchema, insertTemplateSchema, insertWebhookConfigSchema, insertUserSchema } from "@shared/schema";

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

// Global variable to store Socket.IO server
let globalSocketServer: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null {
  return globalSocketServer;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'whatsflow-secret-key-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Start message queue service
  messageQueue.start();

  // Create HTTP server and Socket.IO
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store globally for access from other modules
  globalSocketServer = io;

  // Store socket connections by instance name for QR code delivery
  const instanceSockets = new Map<string, string>();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-instance', (instanceName: string) => {
      console.log(`Client ${socket.id} joined instance: ${instanceName}`);
      socket.join(`instance_${instanceName}`);
      instanceSockets.set(instanceName, socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Remove socket from all instances
      for (const [instanceName, socketId] of instanceSockets.entries()) {
        if (socketId === socket.id) {
          instanceSockets.delete(instanceName);
        }
      }
    });
  });

  // Evolution API Webhook endpoint
  app.post("/webhook/evolution", (req, res) => {
    try {
      const { event, instance, data } = req.body;
      
      console.log('Evolution API Webhook received:', { event, instance, dataKeys: Object.keys(data || {}) });

      if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
        console.log(`QR Code received for instance: ${instance}`);
        
        // Send QR code to connected clients for this instance
        io.to(`instance_${instance}`).emit('qr_code', {
          instance: instance,
          qrCode: data.qrcode || data.code || data.base64
        });
        console.log(`QR Code sent via webhook to instance: ${instance}`);
      } else if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
        console.log(`Connection update for instance ${instance}:`, data);
        
        // Send connection status to client
        const socketId = instanceSockets.get(instance);
        if (socketId) {
          io.to(socketId).emit('connection_update', {
            instance,
            status: data.state || data.connection
          });
        }
      }

      res.sendStatus(200);
    } catch (error: any) {
      console.error('Error processing webhook:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error("Admin check error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  };

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        username: userData.email, // Use email as username
        company: userData.company || "",
        phone: userData.phone || "",
      });

      // Create corresponding client automatically
      await storage.createClient({
        userId: user.id,
        name: userData.company,
        email: userData.email,
        plan: userData.plan,
        status: "active",
      });

      // Create session
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      // Create session
      req.session.userId = user.id;
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.put("/api/auth/change-password", requireAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      
      // Update password
      await storage.updateUser(user.id, { password: hashedNewPassword });
      
      res.json({ message: "Senha alterada com sucesso" });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Dashboard metrics (Admin only)
  app.get("/api/dashboard/metrics", requireAdmin, async (req: any, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client management (Admin only - all clients)
  app.get("/api/clients", requireAdmin, async (req: any, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User routes for their own data
  app.get("/api/user/clients", requireAuth, async (req: any, res) => {
    try {
      const clients = await storage.getClients(req.session.userId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/user/instances", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get the user's client to find their instances
      const clients = await storage.getClients(req.session.userId);
      if (clients.length === 0) {
        return res.json([]);
      }
      
      const instances = await storage.getInstances(clients[0].id);
      
      // Update instances status from Evolution API (same logic as admin route)
      for (const instance of instances) {
        try {
          const evolutionInfo = await evolutionApi.getInstanceInfo(instance.instanceId);
          
          // Map Evolution API status to our status system
          let mappedStatus = 'pending';
          if (evolutionInfo.status === 'open') {
            mappedStatus = 'connected';
          } else if (evolutionInfo.status === 'close') {
            mappedStatus = 'disconnected';
          } else if (evolutionInfo.status === 'connecting') {
            mappedStatus = 'connecting';
          }
          
          if (mappedStatus !== instance.status || evolutionInfo.phoneNumber !== instance.phoneNumber) {
            const updateData: any = { 
              status: mappedStatus,
            };
            
            // Only update phone number if we have one from Evolution API
            if (evolutionInfo.phoneNumber) {
              updateData.phoneNumber = evolutionInfo.phoneNumber;
            }
            
            // Update last connection time if status changed to connected
            if (mappedStatus === 'connected' && instance.status !== 'connected') {
              updateData.lastConnection = new Date();
              
              // Reset daily messages for newly connected instances
              const today = new Date().toDateString();
              const lastConnectionDate = instance.lastConnection ? new Date(instance.lastConnection).toDateString() : null;
              
              if (lastConnectionDate !== today) {
                updateData.dailyMessages = 0;
              }
            }
            
            await storage.updateInstance(instance.id, updateData);
            instance.status = mappedStatus;
            if (evolutionInfo.phoneNumber) {
              instance.phoneNumber = evolutionInfo.phoneNumber;
            }
            if (updateData.lastConnection) {
              instance.lastConnection = updateData.lastConnection;
            }
          }
        } catch (err) {
          console.log(`Failed to update instance ${instance.instanceId}:`, err);
        }
      }
      
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", requireAdmin, async (req: any, res) => {
    try {
      const clientData = {
        ...req.body,
        userId: req.session.userId,
        status: 'active',
        monthlyMessages: 0,
      };
      const validatedData = insertClientSchema.parse(clientData);
      const client = await storage.createClient(validatedData);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, validatedData);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteClient(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp Instances
  app.get("/api/instances", requireAuth, async (req: any, res) => {
    try {
      const instances = await storage.getAllInstances(req.session.userId);
      
      // Update instances status from Evolution API
      for (const instance of instances) {
        try {
          const evolutionInfo = await evolutionApi.getInstanceInfo(instance.instanceId);
          
          // Map Evolution API status to our status system
          let mappedStatus = 'pending';
          if (evolutionInfo.status === 'open') {
            mappedStatus = 'connected';
          } else if (evolutionInfo.status === 'close') {
            mappedStatus = 'disconnected';
          } else if (evolutionInfo.status === 'connecting') {
            mappedStatus = 'connecting';
          }
          
          if (mappedStatus !== instance.status || evolutionInfo.phoneNumber !== instance.phoneNumber) {
            const updateData: any = { 
              status: mappedStatus,
            };
            
            // Only update phone number if we have one from Evolution API
            if (evolutionInfo.phoneNumber) {
              updateData.phoneNumber = evolutionInfo.phoneNumber;
            }
            
            // Update last connection time if status changed to connected
            if (mappedStatus === 'connected' && instance.status !== 'connected') {
              updateData.lastConnection = new Date();
              
              // Reset daily messages for newly connected instances (will be incremented as messages are sent)
              const today = new Date().toDateString();
              const lastConnectionDate = instance.lastConnection ? new Date(instance.lastConnection).toDateString() : null;
              
              // Reset daily count if it's a new day or first connection
              if (lastConnectionDate !== today) {
                updateData.dailyMessages = 0;
              }
            }
            
            await storage.updateInstance(instance.id, updateData);
            instance.status = mappedStatus;
            if (evolutionInfo.phoneNumber) {
              instance.phoneNumber = evolutionInfo.phoneNumber;
            }
            if (updateData.lastConnection) {
              instance.lastConnection = updateData.lastConnection;
            }
          }
        } catch (err) {
          console.log(`Failed to update instance ${instance.instanceId}:`, err);
        }
      }
      
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/instances", async (req, res) => {
    try {
      const { clientId, name } = req.body;
      
      // Check if client already has an instance (1 instance per client limit)
      const existingInstances = await storage.getInstances(clientId);
      if (existingInstances.length > 0) {
        return res.status(400).json({ 
          message: "Cliente já possui uma instância WhatsApp. Limite: 1 instância por cliente." 
        });
      }
      
      const instanceId = `whatsflow_${Date.now()}`;
      
      console.log(`Creating Evolution API instance: ${instanceId}`);
      
      // Create instance in Evolution API
      const evolutionInstance = await evolutionApi.createInstance(instanceId);
      
      // Create instance record in database
      const instanceData = {
        clientId,
        instanceId,
        name,
        status: 'pending',
        phoneNumber: '',
      };
      
      const validatedData = insertInstanceSchema.parse(instanceData);
      const instance = await storage.createInstance(validatedData);
      
      console.log(`Instance created successfully: ${instanceId}`);
      res.json(instance);
    } catch (error: any) {
      console.error('Error creating instance:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/instances/:id/qr", async (req, res) => {
    try {
      const { id } = req.params;
      const instance = await storage.getInstance(id);
      
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }
      
      console.log(`Getting QR code for instance: ${instance.instanceId}`);
      
      // First check if we have a QR code saved in database
      if (instance.qrCode) {
        console.log(`✓ QR code found in database for ${instance.instanceId} (length: ${instance.qrCode.length})`);
        return res.json({
          qrcode: instance.qrCode,
          message: "QR code ready",
          status: "connecting"
        });
      }
      
      // If no QR code in database, try to get from Evolution API
      const qrData = await evolutionApi.getQRCode(instance.instanceId);
      
      console.log('QR result for frontend:', {
        instanceName: instance.instanceId,
        hasQrcode: !!qrData.qrcode,
        qrcodeLength: qrData.qrcode?.length,
        message: qrData.message,
        status: qrData.status
      });
      
      // Update instance with QR code and status if we got one
      if (qrData.qrcode) {
        await storage.updateInstance(id, { 
          qrCode: qrData.qrcode,
          status: 'pending'
        });
      }
      
      res.json(qrData);
    } catch (error: any) {
      console.error('Error getting QR code:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Test Evolution API connection
  app.get("/api/evolution/test", async (req, res) => {
    try {
      const testInstanceName = `test_${Date.now()}`;
      
      console.log('Testing Evolution API connection...');
      const result = await evolutionApi.createInstance(testInstanceName);
      
      // Clean up test instance
      setTimeout(async () => {
        try {
          await evolutionApi.deleteInstance(testInstanceName);
        } catch (err) {
          console.log('Error cleaning up test instance:', err);
        }
      }, 5000);
      
      res.json({ 
        success: true, 
        message: 'Evolution API connection successful',
        result 
      });
    } catch (error: any) {
      console.error('Evolution API test failed:', error.message);
      res.status(500).json({ 
        success: false, 
        message: 'Evolution API connection failed',
        error: error.message 
      });
    }
  });

  app.post("/api/instances/:id/disconnect", async (req, res) => {
    try {
      const { id } = req.params;
      const instance = await storage.getInstance(id);
      
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      // Disconnect from Evolution API
      await evolutionApi.disconnectInstance(instance.instanceId);
      
      // Update status in database and clear QR code for fresh reconnection
      await storage.updateInstance(id, { 
        status: 'disconnected',
        lastConnection: new Date(),
        qrCode: null, // Clear QR code so user can get a fresh one
        phoneNumber: null, // Clear phone number as it will be reassigned
        profileName: null
      });
      
      res.json({ success: true, message: "Instance disconnected. Use 'Reconectar' to get a new QR code." });
    } catch (error: any) {
      console.error('Error disconnecting instance:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/instances/:id/restart", async (req, res) => {
    try {
      const { id } = req.params;
      const instance = await storage.getInstance(id);
      
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      // Update status to connecting first
      await storage.updateInstance(id, { 
        status: 'connecting',
        qrCode: null // Clear old QR code
      });

      // Restart instance in Evolution API
      await evolutionApi.restartInstance(instance.instanceId);
      
      res.json({ success: true, message: "Instance restart initiated. Please wait and check QR code if needed." });
    } catch (error: any) {
      console.error('Error restarting instance:', error.message);
      // Revert status on error
      await storage.updateInstance(id, { status: 'disconnected' });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/instances/:id/test-message", async (req, res) => {
    try {
      const { id } = req.params;
      const { phoneNumber: targetPhone } = req.body;
      const instance = await storage.getInstance(id);
      
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }

      if (instance.status !== 'connected') {
        return res.status(400).json({ message: "Instance must be connected to send test message" });
      }

      // Use provided phone number or instance's own number
      let phoneNumber = targetPhone || instance.phoneNumber;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          message: "Número de telefone não fornecido. Forneça um número ou certifique-se de que a instância está conectada." 
        });
      }

      // Format phone number for WhatsApp (remove formatting and ensure it has country code)
      phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55') && phoneNumber.length === 11) {
        phoneNumber = '55' + phoneNumber; // Add Brazil country code if missing
      }

      const testMessage = `Mensagem de teste do WhatsFlow

Instancia: ${instance.name}
Horario: ${new Date().toLocaleString('pt-BR')}

Sua instancia esta funcionando perfeitamente!`;
      
      await evolutionApi.sendMessage(instance.instanceId, phoneNumber, testMessage);
      
      res.json({ success: true, message: "Test message sent successfully" });
    } catch (error: any) {
      console.error('Error sending test message:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/instances/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const instance = await storage.getInstance(id);
      
      if (!instance) {
        return res.status(404).json({ message: "Instance not found" });
      }
      
      // Try to delete from Evolution API, but continue if it fails (instance might not exist there)
      try {
        await evolutionApi.deleteInstance(instance.instanceId);
      } catch (evolutionError: any) {
        // If Evolution API returns 404, the instance doesn't exist there, which is fine
        if (evolutionError.response?.status !== 404) {
          console.warn(`Warning: Failed to delete instance ${instance.instanceId} from Evolution API:`, evolutionError.message);
        }
      }
      
      // Always delete from our database
      await storage.deleteInstance(id);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Message Templates
  app.get("/api/templates", async (req, res) => {
    try {
      const { clientId, orderStatus } = req.query;
      const templates = await storage.getTemplates(clientId as string, orderStatus as string);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const validatedData = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTemplateSchema.partial().parse(req.body);
      const template = await storage.updateTemplate(id, validatedData);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTemplate(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Webhook configuration
  app.get("/api/webhook-config/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const config = await storage.getWebhookConfig(clientId);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/webhook-config", async (req, res) => {
    try {
      const validatedData = insertWebhookConfigSchema.parse(req.body);
      const config = await storage.createWebhookConfig(validatedData);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/webhook-config/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertWebhookConfigSchema.partial().parse(req.body);
      const config = await storage.updateWebhookConfig(id, validatedData);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/webhook/test", async (req, res) => {
    try {
      const { clientId, webhookUrl, secretKey } = req.body;
      
      // Create a test webhook log
      await storage.createWebhookLog({
        clientId,
        event: 'test.webhook',
        status: 'success',
        response: '200 OK - Test webhook successful',
      });
      
      res.json({ 
        success: true, 
        message: "Webhook teste enviado com sucesso",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: "Erro ao testar webhook",
        error: error.message
      });
    }
  });

  // Message Queue endpoints
  app.get("/api/message-queue", async (req, res) => {
    try {
      // Get all queued messages directly from the database
      console.log('Fetching message queue...');
      const allQueueItems = await storage.getAllQueuedMessages();
      console.log(`Found ${allQueueItems.length} queued messages`);
      
      // Sort by creation time (newest first) - database already does this, but ensuring consistency
      allQueueItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(allQueueItems);
    } catch (error: any) {
      console.error('Error fetching message queue:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/message-queue/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQueuedMessage(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/message-queue/:id/resend", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Update the message to be sent immediately
      await storage.updateQueuedMessage(id, {
        scheduledFor: new Date(),
        status: 'pending',
        error: null,
        sentAt: null
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/message-queue/:id/send-now", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the message and instance details
      const message = await storage.getQueuedMessage(id);
      if (!message) {
        return res.status(404).json({ success: false, message: "Message not found" });
      }
      
      const instance = await storage.getWhatsappInstance(message.whatsappInstanceId);
      if (!instance) {
        return res.status(404).json({ success: false, message: "Instance not found" });
      }
      
      // Send the message directly using the message queue service
      await messageQueueService.sendQueuedMessage(id, instance.instanceId);
      
      res.json({ success: true, message: "Message sent successfully" });
    } catch (error: any) {
      console.error('Error sending message now:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Settings endpoints
  app.get("/api/settings/evolution-api-current", async (req, res) => {
    try {
      // Return current Evolution API configuration
      res.json({
        apiUrl: process.env.EVOLUTION_API_URL || '',
        apiToken: process.env.EVOLUTION_API_KEY || ''
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/evolution-api", async (req, res) => {
    try {
      const { apiUrl, apiToken } = req.body;
      
      // Here you would save the settings to your database or environment
      // For now, we'll just validate the format
      if (!apiUrl || !apiToken) {
        return res.status(400).json({ message: "URL da API e Token são obrigatórios" });
      }
      
      res.json({ success: true, message: "Configurações salvas com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/settings/test-evolution-api", async (req, res) => {
    try {
      const { apiUrl, apiToken } = req.body;
      
      if (!apiUrl || !apiToken) {
        return res.status(400).json({ message: "URL da API e Token são obrigatórios" });
      }
      
      // Test connection to Evolution API
      const testClient = axios.create({
        baseURL: apiUrl,
        headers: {
          'apikey': apiToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      // Try to fetch instances to test the connection
      const response = await testClient.get('/instance/fetchInstances');
      
      res.json({ 
        success: true, 
        message: "Conexão estabelecida com sucesso",
        instanceCount: response.data?.length || 0
      });
    } catch (error: any) {
      console.error('Evolution API test failed:', error.message);
      res.status(500).json({ 
        success: false,
        message: "Falha na conexão com Evolution API",
        error: error.response?.data?.message || error.message
      });
    }
  });

  // Add CORS support for webhook endpoint
  app.options("/api/webhook/woocommerce", (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-client-id, Authorization'
    });
    res.status(200).end();
  });

  // WooCommerce webhook endpoint - Accept any format
  app.post("/api/webhook/woocommerce", async (req, res) => {
    try {
      // Set response headers first
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, x-client-id'
      });

      // Log the incoming request for debugging
      console.log('Webhook received:', {
        headers: req.headers,
        body: req.body,
        method: req.method,
        contentType: req.headers['content-type']
      });

      // Always respond with success regardless of format
      const response = { 
        success: true, 
        message: "Webhook received successfully",
        timestamp: new Date().toISOString()
      };

      // Handle webhook processing
      let event = 'webhook.received';
      let data = req.body || {};
      let clientId = req.headers['x-client-id'] as string || 'demo-client-id';

      // Determine event type from various formats
      if (req.body?.event) {
        event = req.body.event;
        data = req.body.data || req.body;
      } else if (req.body?.id && req.body?.status) {
        event = `order.${req.body.status}`;
        data = req.body;
      } else if (req.body && typeof req.body === 'object') {
        // Generic object - try to detect order events
        if (req.body.order_id || req.body.id) {
          event = 'order.updated';
        }
        data = req.body;
      }

      // Log the webhook asynchronously (don't block response)
      try {
        await storage.createWebhookLog({
          clientId,
          event,
          status: 'received',
          response: '200 OK',
        });

        // Process the webhook based on event type (async)
        if (event.startsWith('order.')) {
          const { order_id, id, status, customer_phone, customer_name, billing, customer } = data;
          const orderId = order_id || id;
          
          if (orderId) {
            // Extract customer info from WooCommerce format
            let clientName = customer_name;
            let clientPhone = customer_phone;
            
            // Try WooCommerce billing format
            if (billing) {
              if (!clientName && (billing.first_name || billing.last_name)) {
                clientName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim();
              }
              if (!clientPhone && billing.phone) {
                clientPhone = billing.phone;
                // Clean and format Brazilian phone number
                clientPhone = clientPhone.replace(/\D/g, ''); // Remove all non-digits
                if (!clientPhone.startsWith('55') && clientPhone.length === 11) {
                  clientPhone = '55' + clientPhone; // Add country code if missing
                }
                clientPhone = '+' + clientPhone; // Add + prefix
              }
            }
            
            // Try WooCommerce customer format
            if (customer && !clientName && (customer.first_name || customer.last_name)) {
              clientName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            }
            
            // Default values
            clientName = clientName || 'Cliente';
            clientPhone = clientPhone || '+5511999999999';
            
            console.log(`Processing order ${orderId} for ${clientName} (${clientPhone}) - Status: ${status}`);
            
            // Get templates for this order status
            const templates = await storage.getTemplates(clientId, status);
            
            // Get client's WhatsApp instance
            const instances = await storage.getInstances(clientId);
            const activeInstance = instances.find(i => i.status === 'connected');
            
            if (activeInstance && templates.length > 0) {
              console.log(`Found ${templates.length} templates and active instance for ${clientName}`);
              
              // Schedule messages
              for (const template of templates) {
                const message = template.content
                  .replace('{{nome_cliente}}', clientName)
                  .replace('{{numero_pedido}}', orderId)
                  .replace('{{status_pedido}}', status || 'atualizado');
                
                await messageQueue.scheduleMessage(
                  activeInstance.id,
                  template.id,
                  clientPhone,
                  message,
                  template.delayMinutes || 0
                );
                
                console.log(`Message scheduled for ${clientName} via template "${template.content.substring(0, 50)}..."`);
              }
            } else {
              console.log(`No templates or active instance found for client ${clientId}, status ${status}`);
            }
          }
        }
      } catch (processingError) {
        console.error('Webhook processing error (non-critical):', processingError);
      }
      
      // Always return success immediately to WooCommerce
      res.json(response);
    } catch (error: any) {
      console.error('Webhook error:', error);
      
      // Try to log error if possible
      try {
        const errorClientId = req.headers['x-client-id'] as string || 'demo-client-id';
        await storage.createWebhookLog({
          clientId: errorClientId,
          event: req.body?.event || 'unknown',
          status: 'error',
          response: error.message,
        });
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
      
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Webhook logs
  app.get("/api/webhook-logs/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const logs = await storage.getWebhookLogs(clientId);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe subscription endpoint
  app.post('/api/create-subscription', async (req, res) => {
    try {
      const { plan, email, name } = req.body;
      
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        name,
      });

      // Define plan prices
      const planPrices = {
        basic: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic',
        pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
        enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
      };

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: planPrices[plan as keyof typeof planPrices],
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Diagnose QR code generation issues
  app.get("/api/evolution/diagnose", async (req, res) => {
    try {
      console.log('Starting Evolution API diagnosis...');
      
      // Get all instances
      const instances = await evolutionApi.getAllInstances();
      const connectingInstances = instances.filter((inst: any) => inst.connectionStatus === 'connecting');
      const openInstances = instances.filter((inst: any) => inst.connectionStatus === 'open');
      
      console.log(`Found ${connectingInstances.length} connecting instances and ${openInstances.length} open instances`);
      
      const diagnosis = {
        totalInstances: instances.length,
        connectingInstances: connectingInstances.length,
        openInstances: openInstances.length,
        connectingInstancesDetails: connectingInstances.map((inst: any) => ({
          name: inst.name,
          status: inst.connectionStatus,
          createdAt: inst.createdAt,
          ageMinutes: Math.round((new Date().getTime() - new Date(inst.createdAt).getTime()) / 1000 / 60)
        })),
        qrTestResults: [] as any[]
      };
      
      // Test QR generation for a few connecting instances
      for (const instance of connectingInstances.slice(0, 3)) {
        try {
          console.log(`Testing QR for instance: ${instance.name}`);
          const qrResponse = await evolutionApi.connectInstance(instance.name);
          diagnosis.qrTestResults.push({
            instanceName: instance.name,
            hasQrCode: !!qrResponse?.qrcode,
            responseType: typeof qrResponse,
            responseKeys: Object.keys(qrResponse || {}),
            error: null
          });
        } catch (error: any) {
          diagnosis.qrTestResults.push({
            instanceName: instance.name,
            hasQrCode: false,
            error: error.message
          });
        }
      }
      
      res.json(diagnosis);
    } catch (error: any) {
      console.error('Error in Evolution API diagnosis:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
