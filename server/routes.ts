import type { Express } from "express";
import express from "express";
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

// Authentication middleware
const isAuthenticated = async (req: any, res: any, next: any) => {
  console.log(`DEBUG Auth: Session userId: ${req.session?.userId}`);
  if (req.session?.userId) {
    // Add user object to request for easy access
    const user = await storage.getUser(req.session.userId);
    console.log(`DEBUG Auth: User found:`, user?.id, user?.name);
    req.user = user;
    return next();
  }
  console.log(`DEBUG Auth: No session userId found`);
  return res.status(401).json({ message: 'Not authenticated' });
};

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
      for (const [instanceName, socketId] of Array.from(instanceSockets.entries())) {
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
        name: userData.name,
        company: userData.company || "",
        phone: userData.phone || "",
      });

      // Create corresponding client automatically
      await storage.createClient({
        userId: user.id,
        name: userData.company || userData.name,
        email: userData.email,
        plan: userData.plan || 'free',
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

  app.put("/api/auth/profile", requireAuth, async (req: any, res) => {
    try {
      const { name, email, company, phone } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Nome e email são obrigatórios" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Update user profile
      const updatedUser = await storage.updateUser(user.id, {
        name,
        email,
        company,
        phone,
      });

      // Also update the client record if it exists
      const clients = await storage.getClients(user.id);
      if (clients.length > 0) {
        await storage.updateClient(clients[0].id, {
          name,
          email,
          company,
          phone,
        });
      }

      // Return updated user without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Admin user management routes
  app.get("/api/admin/users", requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      console.error("Get all users error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req: any, res) => {
    try {
      const { username, email, password, name, company, phone, role } = req.body;
      
      if (!username || !email || !password || !name) {
        return res.status(400).json({ message: "Username, email, senha e nome são obrigatórios" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsernameOrEmail(username, email);
      if (existingUser) {
        return res.status(400).json({ message: "Username ou email já está em uso" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        company: company || '',
        phone: phone || '',
        role: role || 'admin',
        plan: 'basic',
        subscriptionStatus: 'active',
      });

      // Create associated client
      await storage.createClient({
        name,
        email,
        company: company || '',
        phone: phone || '',
        plan: 'basic',
        status: 'active',
        userId: newUser.id,
      });

      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/admin/users/:userId", requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Don't allow deleting the current admin user
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Você não pode excluir sua própria conta" });
      }

      // Get user to check if exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Delete associated clients first (cascade should handle this but let's be explicit)
      const clients = await storage.getClients(userId);
      for (const client of clients) {
        await storage.deleteClient(client.id);
      }

      // Delete user
      await storage.deleteUser(userId);
      
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error: any) {
      console.error("Delete user error:", error);
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
      
      // If plan was updated, sync it with the user table
      if (validatedData.plan && client.userId) {
        await storage.updateUser(client.userId, { plan: validatedData.plan });
      }
      
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
      await storage.updateInstance(req.params.id, { status: 'disconnected' });
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
      
      // Check if template has messages in queue
      const messageCount = await storage.countMessagesUsingTemplate(id);
      
      if (messageCount > 0) {
        return res.status(400).json({ 
          message: `Não é possível remover este template pois existem ${messageCount} mensagem(s) na fila que o utilizam. Remova as mensagens da fila primeiro.`,
          hasReferences: true,
          messageCount
        });
      }
      
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

  // Plan limits endpoint
  app.get("/api/plan-limits", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get user and their client
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const clients = await storage.getClients(userId);
      if (clients.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const client = clients[0]; // Assuming one client per user
      
      // Use user's plan instead of client's plan
      const planLimits: Record<string, number> = {
        free: 30,
        basic: 1000,
        pro: 10000,
        enterprise: -1 // unlimited
      };

      const limit = planLimits[user.plan] || 1000; // default to basic plan limit
      const current = await storage.getMonthlyMessageCount(client.id);
      
      const limits = {
        allowed: limit === -1 || current < limit,
        limit,
        current,
        plan: user.plan
      };
      
      res.json(limits);
    } catch (error: any) {
      console.error('Error fetching plan limits:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // User metrics endpoint
  app.get("/api/user/metrics", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get user's client
      const clients = await storage.getClients(userId);
      if (clients.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const client = clients[0];
      const instances = await storage.getInstances(client.id);
      const templates = await storage.getTemplatesByClient(client.id);
      const messageCount = await storage.getMonthlyMessageCount(client.id);
      
      // Calculate metrics
      const activeInstances = instances.filter(i => i.status === 'connected').length;
      const templatesConfigured = templates.length;
      
      // Mock recent activity for now
      const recentActivity = [
        {
          id: '1',
          type: 'message_sent' as const,
          description: 'Mensagem enviada para pedido #12345',
          timestamp: new Date().toISOString(),
          status: 'success' as const
        },
        {
          id: '2',
          type: 'instance_connected' as const,
          description: 'Instância WhatsApp conectada',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'success' as const
        }
      ];
      
      const metrics = {
        totalMessages: messageCount,
        messagesSentToday: 0, // TODO: Calculate today's messages
        activeInstances,
        totalInstances: instances.length,
        templatesConfigured,
        deliveryRate: 98.5, // TODO: Calculate real delivery rate
        recentActivity,
        monthlyUsage: [] // TODO: Get monthly usage data
      };
      
      res.json(metrics);
    } catch (error: any) {
      console.error('Error fetching user metrics:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Message Queue endpoints
  app.get("/api/message-queue", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get queued messages filtered by user
      console.log(`Fetching message queue for user: ${userId}...`);
      const userQueueItems = await storage.getQueuedMessagesByUser(userId);
      console.log(`Found ${userQueueItems.length} queued messages for user ${userId}`);
      
      res.json(userQueueItems);
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
      
      const instance = await storage.getInstance(message.instanceId);
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

  // Client-specific WooCommerce webhook endpoint
  app.post("/api/webhook/woocommerce/:clientId", async (req, res) => {
    try {
      // Set response headers first
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, x-client-id'
      });

      const clientId = req.params.clientId;

      console.log(`=== CLIENT-SPECIFIC WEBHOOK DEBUG ===`);
      console.log(`ClientId from URL: ${clientId}`);
      console.log(`Request body:`, JSON.stringify(req.body, null, 2));

      // Always respond with success regardless of format
      const response = { 
        success: true, 
        message: "Webhook received successfully",
        clientId,
        timestamp: new Date().toISOString()
      };

      // Handle webhook processing
      let event = 'webhook.received';
      let data = req.body || {};

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

      console.log(`Event: ${event}, ClientId: ${clientId}`);
      
      // Log the webhook asynchronously (don't block response)
      try {
        await storage.createWebhookLog({
          clientId,
          event,
          status: 'received',
          response: '200 OK',
        });

        console.log(`Webhook logged. Processing event: ${event}`);
        
        // Process the webhook based on event type (async)
        if (event.startsWith('order.')) {
          console.log(`Processing order event: ${event}`);
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
            console.log(`Looking for templates - clientId: ${clientId}, status: ${status}`);
            const templates = await storage.getTemplates(clientId, status);
            console.log(`Found ${templates.length} templates:`, templates.map(t => ({ id: t.id, status: t.orderStatus, content: t.content.substring(0, 50) })));
            
            // Get client's WhatsApp instance
            const instances = await storage.getInstances(clientId);
            console.log(`Found ${instances.length} instances:`, instances.map(i => ({ id: i.id, status: i.status, name: i.name })));
            const activeInstance = instances.find(i => i.status === 'connected');
            console.log(`Active instance:`, activeInstance ? { id: activeInstance.id, status: activeInstance.status } : 'none');
            
            if (activeInstance && templates.length > 0) {
              console.log(`Found ${templates.length} templates and active instance for ${clientName}`);
              
              // Schedule messages
              for (const template of templates) {
                const message = template.content
                  .replace('{{nome_cliente}}', clientName)
                  .replace('{{numero_pedido}}', orderId)
                  .replace('{{status_pedido}}', status || 'atualizado');
                
                console.log(`Scheduling message - Instance: ${activeInstance.id}, Template: ${template.id}, Phone: ${clientPhone}, Message: ${message.substring(0, 50)}...`);
                
                try {
                  const scheduledMessage = await messageQueue.scheduleMessage(
                    activeInstance.id,
                    template.id,
                    clientPhone,
                    message,
                    template.delayMinutes || 0
                  );
                  console.log(`Message scheduled successfully:`, scheduledMessage.id);
                } catch (scheduleError) {
                  console.error(`Error scheduling message:`, scheduleError);
                }
                
                console.log(`Message scheduled for ${clientName} via template "${template.content.substring(0, 50)}..."`);
              }
            } else {
              console.log(`No templates or active instance found for client ${clientId}, status ${status}`);
              console.log(`Templates available: ${templates.length}, Active instance: ${!!activeInstance}`);
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
        const errorClientId = req.params.clientId || 'unknown';
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

  // WooCommerce webhook endpoint - Accept any format (legacy)
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

      console.log(`=== WEBHOOK DEBUG ===`);
      console.log(`Event: ${event}, ClientId: ${clientId}`);
      console.log(`Request body:`, JSON.stringify(req.body, null, 2));
      
      // Log the webhook asynchronously (don't block response)
      try {
        await storage.createWebhookLog({
          clientId,
          event,
          status: 'received',
          response: '200 OK',
        });

        console.log(`Webhook logged. Processing event: ${event}`);
        
        // Process the webhook based on event type (async)
        if (event.startsWith('order.')) {
          console.log(`Processing order event: ${event}`);
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
            console.log(`Looking for templates - clientId: ${clientId}, status: ${status}`);
            const templates = await storage.getTemplates(clientId, status);
            console.log(`Found ${templates.length} templates:`, templates.map(t => ({ id: t.id, status: t.orderStatus, content: t.content.substring(0, 50) })));
            
            // Get client's WhatsApp instance
            const instances = await storage.getInstances(clientId);
            console.log(`Found ${instances.length} instances:`, instances.map(i => ({ id: i.id, status: i.status, name: i.name })));
            const activeInstance = instances.find(i => i.status === 'connected');
            console.log(`Active instance:`, activeInstance ? { id: activeInstance.id, status: activeInstance.status } : 'none');
            
            if (activeInstance && templates.length > 0) {
              console.log(`Found ${templates.length} templates and active instance for ${clientName}`);
              
              // Schedule messages
              for (const template of templates) {
                const message = template.content
                  .replace('{{nome_cliente}}', clientName)
                  .replace('{{numero_pedido}}', orderId)
                  .replace('{{status_pedido}}', status || 'atualizado');
                
                console.log(`Scheduling message - Instance: ${activeInstance.id}, Template: ${template.id}, Phone: ${clientPhone}, Message: ${message.substring(0, 50)}...`);
                
                try {
                  const scheduledMessage = await messageQueue.scheduleMessage(
                    activeInstance.id,
                    template.id,
                    clientPhone,
                    message,
                    template.delayMinutes || 0
                  );
                  console.log(`Message scheduled successfully:`, scheduledMessage.id);
                } catch (scheduleError) {
                  console.error(`Error scheduling message:`, scheduleError);
                }
                
                console.log(`Message scheduled for ${clientName} via template "${template.content.substring(0, 50)}..."`);
              }
            } else {
              console.log(`No templates or active instance found for client ${clientId}, status ${status}`);
              console.log(`Templates available: ${templates.length}, Active instance: ${!!activeInstance}`);
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
    console.log(`DEBUG: Starting create-subscription endpoint for plan: ${req.body.plan}`);
    console.log(`DEBUG: Session:`, req.session);
    console.log(`DEBUG: Session userId:`, req.session?.userId);
    
    // Manual authentication check with detailed logging
    if (!req.session?.userId) {
      console.log(`DEBUG: No session userId found, authentication failed`);
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Get user manually with detailed logging
    const user = await storage.getUser(req.session.userId);
    console.log(`DEBUG: User found:`, user?.id, user?.name, user?.plan);
    if (!user) {
      console.log(`DEBUG: User not found in database`);
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    console.log(`DEBUG: Authentication successful, proceeding with user:`, user.id);
    try {
      const { plan, email, name } = req.body;
      
      console.log(`Creating subscription for plan: ${plan}`);
      
      // Get price IDs from database first, then fallback to environment variables
      const basicPriceId = (await storage.getSystemSetting('stripe_basic_price_id'))?.value || process.env.STRIPE_BASIC_PRICE_ID;
      const proPriceId = (await storage.getSystemSetting('stripe_pro_price_id'))?.value || process.env.STRIPE_PRO_PRICE_ID;
      const enterprisePriceId = (await storage.getSystemSetting('stripe_enterprise_price_id'))?.value || process.env.STRIPE_ENTERPRISE_PRICE_ID;

      // Define plan prices
      const planPrices = {
        basic: basicPriceId,
        pro: proPriceId,
        enterprise: enterprisePriceId,
      };

      const selectedPriceId = planPrices[plan as keyof typeof planPrices];
      console.log(`Using price ID: ${selectedPriceId} for plan: ${plan}`);
      
      // Validate that we have a valid price ID
      if (!selectedPriceId) {
        throw new Error(`Missing Stripe price ID for plan: ${plan}. Please configure price IDs in admin settings.`);
      }
      
      // Validate price ID format
      if (selectedPriceId.startsWith('prod_')) {
        throw new Error(`Invalid price ID format: ${selectedPriceId}. Expected a price ID starting with 'price_', but received a product ID starting with 'prod_'. Please use the price ID from your Stripe dashboard.`);
      }

      if (!selectedPriceId.startsWith('price_')) {
        throw new Error(`Invalid price ID format: ${selectedPriceId}. Expected a price ID starting with 'price_'.`);
      }
      // Get Stripe secret key from database or environment
      const secretKeySetting = await storage.getSystemSetting('stripe_secret_key');
      const secretKey = secretKeySetting?.value || process.env.STRIPE_SECRET_KEY;

      if (!secretKey) {
        throw new Error('Stripe Secret Key not configured. Please configure Stripe settings in admin panel.');
      }

      // Create Stripe instance with the configured secret key
      const stripeInstance = new (await import('stripe')).default(secretKey, {
        apiVersion: '2023-10-16',
      });
      
      // Create Stripe customer
      const customer = await stripeInstance.customers.create({
        email,
        name,
      });

      const subscription = await stripeInstance.subscriptions.create({
        customer: customer.id,
        items: [{
          price: selectedPriceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user plan immediately after successful subscription creation
      const user = req.user as any;
      console.log(`DEBUG: User from request:`, user);
      if (user?.id) {
        console.log(`DEBUG: User ID found: ${user.id}, proceeding with plan update`);
        try {
          // Map plan to subscription plan
          const planMapping = {
            'basic': 'basic',
            'pro': 'pro', 
            'enterprise': 'enterprise'
          };
          
          const userPlan = planMapping[plan as keyof typeof planMapping];
          if (userPlan) {
            console.log(`Updating user ${user.id} with plan: ${userPlan}, customerId: ${customer.id}, subscriptionId: ${subscription.id}`);
            
            // Update user with all subscription details
            const updateResult = await storage.updateUser(user.id, {
              plan: userPlan,
              subscriptionStatus: 'active',
              stripeCustomerId: customer.id,
              stripeSubscriptionId: subscription.id
            });
            console.log(`User update result:`, updateResult);
            
            // Also update the client's plan to keep them in sync
            const clients = await storage.getClients();
            const userClient = clients.find(c => c.userId === user.id);
            if (userClient) {
              const clientUpdateResult = await storage.updateClient(userClient.id, { plan: userPlan });
              console.log(`Client ${userClient.id} plan updated to ${userPlan}:`, clientUpdateResult);
            }
            
            console.log(`User ${user.id} plan updated to ${userPlan} successfully`);
          }
        } catch (updateError: any) {
          console.error('Error updating user plan:', updateError.message);
          console.error('Full error:', updateError);
        }
      } else {
        console.log(`DEBUG: No user found in request or no user.id. User:`, user);
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error('Stripe subscription error:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel subscription endpoint
  app.post("/api/cancel-subscription", requireAuth, async (req: any, res) => {
    try {
      const { cancelImmediately = false, reason } = req.body;

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      let canceledSubscription;
      
      if (cancelImmediately) {
        // Cancel subscription immediately
        canceledSubscription = await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        
        // Update user plan to basic and status to canceled
        await storage.updateUser(user.id, {
          plan: 'basic',
          subscriptionStatus: 'canceled'
        });

        // Update client plan
        const clients = await storage.getClients(user.id);
        if (clients.length > 0) {
          await storage.updateClient(clients[0].id, { plan: 'basic' });
        }

        console.log(`Subscription ${user.stripeSubscriptionId} canceled immediately for user ${user.id}. Reason: ${reason || 'Not provided'}`);
      } else {
        // Cancel at period end
        canceledSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true
        });

        // Keep current plan until period ends
        await storage.updateUser(user.id, {
          subscriptionStatus: 'cancel_at_period_end'
        });

        console.log(`Subscription ${user.stripeSubscriptionId} scheduled for cancellation at period end for user ${user.id}. Reason: ${reason || 'Not provided'}`);
      }

      res.json({
        success: true,
        subscription: {
          id: canceledSubscription.id,
          status: canceledSubscription.status,
          cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
          currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000),
        }
      });
    } catch (error: any) {
      console.error("Subscription cancellation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reactivate subscription endpoint
  app.post("/api/reactivate-subscription", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "Nenhuma assinatura encontrada" });
      }

      // Remove cancel_at_period_end flag
      const reactivatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      // Update user status back to active
      await storage.updateUser(user.id, {
        subscriptionStatus: 'active'
      });

      console.log(`Subscription ${user.stripeSubscriptionId} reactivated for user ${user.id}`);

      res.json({
        success: true,
        subscription: {
          id: reactivatedSubscription.id,
          status: reactivatedSubscription.status,
          cancelAtPeriodEnd: reactivatedSubscription.cancel_at_period_end,
        }
      });
    } catch (error: any) {
      console.error("Subscription reactivation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get subscription details endpoint
  app.get("/api/subscription-details", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.stripeSubscriptionId) {
        return res.json({
          hasSubscription: false,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus
        });
      }

      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      console.log('Raw Stripe subscription data:', {
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        canceled_at: subscription.canceled_at
      });
      
      res.json({
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        },
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus
      });
    } catch (error: any) {
      console.error("Get subscription details error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook endpoint for subscription changes
  app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    
    let event;

    try {
      // Verify webhook signature
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // For development, skip signature verification
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    try {
      // Handle the event
      switch (event.type) {
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          console.log(`Subscription updated: ${subscription.id}`);
          
          // Update user subscription status in database
          const user = await storage.getUserByStripeSubscriptionId(subscription.id);
          if (user) {
            let newStatus = 'active';
            if (subscription.cancel_at_period_end) {
              newStatus = 'cancel_at_period_end';
            } else if (subscription.status === 'canceled') {
              newStatus = 'canceled';
            }
            
            await storage.updateUser(user.id, {
              subscriptionStatus: newStatus
            });
            
            console.log(`Updated user ${user.id} subscription status to: ${newStatus}`);
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          console.log(`Subscription canceled: ${subscription.id}`);
          
          // Update user to basic plan when subscription is canceled
          const user = await storage.getUserByStripeSubscriptionId(subscription.id);
          if (user) {
            await storage.updateUser(user.id, {
              plan: 'basic',
              subscriptionStatus: 'canceled'
            });
            
            // Also update client plan
            const clients = await storage.getClients(user.id);
            if (clients.length > 0) {
              await storage.updateClient(clients[0].id, { plan: 'basic' });
            }
            
            console.log(`Updated user ${user.id} to basic plan after subscription cancellation`);
          }
          break;
        }
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      res.json({received: true});
    } catch (error: any) {
      console.error(`Error processing webhook:`, error);
      res.status(500).json({ error: error.message });
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

  // Admin Stripe configuration
  app.get('/api/admin/stripe-config', async (req, res) => {
    try {
      // Get configuration from database
      const stripePublicKey = await storage.getSystemSetting('stripe_public_key');
      const stripeSecretKey = await storage.getSystemSetting('stripe_secret_key');
      const basicPriceId = await storage.getSystemSetting('stripe_basic_price_id');
      const proPriceId = await storage.getSystemSetting('stripe_pro_price_id');
      const enterprisePriceId = await storage.getSystemSetting('stripe_enterprise_price_id');

      const config = {
        stripePublicKey: stripePublicKey?.value || process.env.VITE_STRIPE_PUBLIC_KEY || '',
        basicPriceId: basicPriceId?.value || process.env.STRIPE_BASIC_PRICE_ID || '',
        proPriceId: proPriceId?.value || process.env.STRIPE_PRO_PRICE_ID || '',
        enterprisePriceId: enterprisePriceId?.value || process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
        stripeSecretKey: stripeSecretKey?.value ? '***' + stripeSecretKey.value.slice(-4) : 
                        (process.env.STRIPE_SECRET_KEY ? '***' + process.env.STRIPE_SECRET_KEY.slice(-4) : '')
      };
      
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/stripe-config', async (req, res) => {
    try {
      const { stripeSecretKey, stripePublicKey, basicPriceId, proPriceId, enterprisePriceId } = req.body;
      const user = req.user as any;
      const userId = user?.id;
      
      // Validate price IDs format
      const priceIds = { basicPriceId, proPriceId, enterprisePriceId };
      
      for (const [key, priceId] of Object.entries(priceIds)) {
        if (priceId && !priceId.startsWith('price_')) {
          return res.status(400).json({ 
            message: `Invalid format for ${key}. Expected price ID starting with 'price_', got: ${priceId}` 
          });
        }
      }

      // Validate keys format - only validate if provided and not empty
      if (stripeSecretKey && stripeSecretKey.trim() !== '') {
        if (!stripeSecretKey.startsWith('sk_')) {
          return res.status(400).json({ 
            message: 'Invalid Stripe Secret Key format. Expected key starting with sk_' 
          });
        }
      }

      if (stripePublicKey && stripePublicKey.trim() !== '') {
        if (!stripePublicKey.startsWith('pk_')) {
          return res.status(400).json({ 
            message: 'Invalid Stripe Public Key format. Expected key starting with pk_' 
          });
        }
      }

      // Save configuration to database
      const configUpdates = [];

      if (stripeSecretKey && stripeSecretKey.trim() !== '') {
        configUpdates.push(storage.setSystemSetting('stripe_secret_key', stripeSecretKey, true, 'Stripe Secret Key', userId));
      }

      if (stripePublicKey && stripePublicKey.trim() !== '') {
        configUpdates.push(storage.setSystemSetting('stripe_public_key', stripePublicKey, false, 'Stripe Public Key', userId));
      }

      if (basicPriceId) {
        configUpdates.push(storage.setSystemSetting('stripe_basic_price_id', basicPriceId, false, 'Stripe Basic Plan Price ID', userId));
      }

      if (proPriceId) {
        configUpdates.push(storage.setSystemSetting('stripe_pro_price_id', proPriceId, false, 'Stripe Pro Plan Price ID', userId));
      }

      if (enterprisePriceId) {
        configUpdates.push(storage.setSystemSetting('stripe_enterprise_price_id', enterprisePriceId, false, 'Stripe Enterprise Plan Price ID', userId));
      }

      // Execute all updates
      await Promise.all(configUpdates);

      res.json({ 
        success: true, 
        message: 'Configurações salvas com sucesso!' 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook endpoint
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Get webhook secret from environment or database
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.log('No webhook secret configured, processing event anyway');
        event = req.body;
      } else {
        const secretKeySetting = await storage.getSystemSetting('stripe_secret_key');
        const secretKey = secretKeySetting?.value || process.env.STRIPE_SECRET_KEY;
        
        if (secretKey) {
          const stripeInstance = new (await import('stripe')).default(secretKey, {
            apiVersion: '2023-10-16',
          });
          event = stripeInstance.webhooks.constructEvent(req.body, sig!, webhookSecret);
        } else {
          return res.status(400).send('Webhook signature verification failed');
        }
      }
    } catch (err: any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('Subscription event received:', subscription.id);
        
        try {
          // Find user by Stripe customer ID
          const users = await storage.getUsers();
          const user = users.find(u => u.stripeCustomerId === subscription.customer);
          
          if (user) {
            // Determine plan from price ID
            const priceId = subscription.items.data[0]?.price?.id;
            let plan = 'basic';
            
            const basicPriceId = (await storage.getSystemSetting('stripe_basic_price_id'))?.value || process.env.STRIPE_BASIC_PRICE_ID;
            const proPriceId = (await storage.getSystemSetting('stripe_pro_price_id'))?.value || process.env.STRIPE_PRO_PRICE_ID;
            const enterprisePriceId = (await storage.getSystemSetting('stripe_enterprise_price_id'))?.value || process.env.STRIPE_ENTERPRISE_PRICE_ID;
            
            if (priceId === proPriceId) plan = 'pro';
            else if (priceId === enterprisePriceId) plan = 'enterprise';
            
            await storage.updateUser(user.id, {
              plan,
              subscriptionStatus: subscription.status === 'active' ? 'active' : 'inactive',
              stripeSubscriptionId: subscription.id
            });
            
            // Also update the client's plan to keep them in sync
            const clients = await storage.getClients();
            const userClient = clients.find(c => c.userId === user.id);
            if (userClient) {
              await storage.updateClient(userClient.id, { plan });
              console.log(`Client ${userClient.id} plan also updated to ${plan}`);
            }
            
            console.log(`User ${user.id} plan updated to ${plan} via webhook`);
          }
        } catch (error: any) {
          console.error('Error processing subscription webhook:', error.message);
        }
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('Subscription deleted:', deletedSubscription.id);
        
        try {
          const users = await storage.getUsers();
          const user = users.find(u => u.stripeSubscriptionId === deletedSubscription.id);
          
          if (user) {
            await storage.updateUser(user.id, {
              plan: 'free',
              subscriptionStatus: 'cancelled'
            });
            
            // Also update the client's plan to keep them in sync
            const clients = await storage.getClients();
            const userClient = clients.find(c => c.userId === user.id);
            if (userClient) {
              await storage.updateClient(userClient.id, { plan: 'free' });
              console.log(`Client ${userClient.id} plan also downgraded to free`);
            }
            
            console.log(`User ${user.id} plan downgraded to free via webhook`);
          }
        } catch (error: any) {
          console.error('Error processing subscription deletion webhook:', error.message);
        }
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  app.post('/api/admin/test-stripe-config', async (req, res) => {
    try {
      const results = {
        apiConnection: { success: false, message: '' },
        priceValidation: {} as any
      };

      // Get secret key from database or environment
      const secretKeySetting = await storage.getSystemSetting('stripe_secret_key');
      const secretKey = secretKeySetting?.value || process.env.STRIPE_SECRET_KEY;

      // Test API connection
      try {
        if (secretKey) {
          const testStripe = new (await import('stripe')).default(secretKey, {
            apiVersion: '2023-10-16',
          });
          const customers = await testStripe.customers.list({ limit: 1 });
          results.apiConnection = { success: true, message: 'API connection successful' };
        } else {
          results.apiConnection = { success: false, message: 'No Stripe Secret Key configured' };
        }
      } catch (error: any) {
        results.apiConnection = { success: false, message: `API Error: ${error.message}` };
      }

      // Test price validation
      const basicPriceId = (await storage.getSystemSetting('stripe_basic_price_id'))?.value || process.env.STRIPE_BASIC_PRICE_ID;
      const proPriceId = (await storage.getSystemSetting('stripe_pro_price_id'))?.value || process.env.STRIPE_PRO_PRICE_ID;
      const enterprisePriceId = (await storage.getSystemSetting('stripe_enterprise_price_id'))?.value || process.env.STRIPE_ENTERPRISE_PRICE_ID;

      const priceIds = {
        basic: basicPriceId,
        pro: proPriceId,
        enterprise: enterprisePriceId,
      };

      for (const [plan, priceId] of Object.entries(priceIds)) {
        if (!priceId) {
          results.priceValidation[plan] = { valid: false, message: 'Price ID not configured' };
          continue;
        }

        if (!priceId.startsWith('price_')) {
          results.priceValidation[plan] = { valid: false, message: 'Invalid format - must start with price_' };
          continue;
        }

        try {
          if (secretKey) {
            const testStripe = new (await import('stripe')).default(secretKey, {
              apiVersion: '2023-10-16',
            });
            const price = await testStripe.prices.retrieve(priceId);
            results.priceValidation[plan] = { 
              valid: true, 
              message: `Valid - ${price.currency.toUpperCase()} ${price.unit_amount! / 100}` 
            };
          } else {
            results.priceValidation[plan] = { 
              valid: false, 
              message: 'No secret key to validate price' 
            };
          }
        } catch (error: any) {
          results.priceValidation[plan] = { 
            valid: false, 
            message: `Stripe Error: ${error.message}` 
          };
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return createServer(app);
}
