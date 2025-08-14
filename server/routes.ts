import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import Stripe from "stripe";
import { storage } from "./storage";
import { evolutionApi } from "./services/evolutionApi";
import { messageQueue } from "./services/messageQueue";
import { insertClientSchema, insertInstanceSchema, insertTemplateSchema, insertWebhookConfigSchema } from "@shared/schema";

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

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      // In a real app, you'd get userId from authentication
      const userId = "68a6ee4a-0647-447d-913f-2bed17557e96"; // Admin user ID
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client management
  app.get("/api/clients", async (req, res) => {
    try {
      const userId = "68a6ee4a-0647-447d-913f-2bed17557e96"; // Admin user ID
      const clients = await storage.getClients(userId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const userId = "68a6ee4a-0647-447d-913f-2bed17557e96"; // Admin user ID
      const clientData = {
        ...req.body,
        userId,
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

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, validatedData);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteClient(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp Instances
  app.get("/api/instances", async (req, res) => {
    try {
      const userId = "68a6ee4a-0647-447d-913f-2bed17557e96"; // Admin user ID
      const instances = await storage.getAllInstances(userId);
      
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
              // Simulate some daily messages for connected instances
              updateData.dailyMessages = Math.floor(Math.random() * 50) + 10;
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
      
      // Delete from Evolution API
      await evolutionApi.deleteInstance(instance.instanceId);
      
      // Delete from database
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

  // WooCommerce webhook endpoint
  app.post("/api/webhook/woocommerce", async (req, res) => {
    try {
      const { event, data } = req.body;
      const clientId = req.headers['x-client-id'] as string;
      
      if (!clientId) {
        return res.status(400).json({ message: "Client ID required" });
      }
      
      // Log the webhook
      await storage.createWebhookLog({
        clientId,
        event,
        status: 'received',
        response: '200 OK',
      });
      
      // Process the webhook based on event type
      if (event === 'order.status_changed' || event === 'order.created') {
        const { order_id, status, customer_phone, customer_name } = data;
        
        // Get templates for this order status
        const templates = await storage.getTemplates(clientId, status);
        
        // Get client's WhatsApp instance
        const instances = await storage.getInstances(clientId);
        const activeInstance = instances.find(i => i.status === 'connected');
        
        if (activeInstance && templates.length > 0) {
          // Schedule messages
          for (const template of templates) {
            const message = template.content
              .replace('{{nome_cliente}}', customer_name)
              .replace('{{numero_pedido}}', order_id)
              .replace('{{status_pedido}}', status);
            
            await messageQueue.scheduleMessage(
              activeInstance.id,
              template.id,
              customer_phone,
              message,
              template.delayMinutes || 0
            );
          }
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      await storage.createWebhookLog({
        clientId: req.headers['x-client-id'] as string || 'unknown',
        event: req.body.event || 'unknown',
        status: 'error',
        response: error.message,
      });
      
      res.status(500).json({ message: error.message });
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
