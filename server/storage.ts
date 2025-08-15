import { users, clients, whatsappInstances, messageTemplates, webhookConfigs, webhookLogs, messageQueue, systemSettings, type User, type InsertUser, type Client, type InsertClient, type WhatsappInstance, type InsertInstance, type MessageTemplate, type InsertTemplate, type WebhookConfig, type InsertWebhookConfig, type WebhookLog, type MessageQueueItem, type SystemSetting, type InsertSystemSetting } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gt, gte } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User>;
  
  // Client methods
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // WhatsApp Instance methods
  getInstances(clientId: string): Promise<WhatsappInstance[]>;
  getAllInstances(userId: string): Promise<WhatsappInstance[]>;
  getInstance(id: string): Promise<WhatsappInstance | undefined>;
  createInstance(instance: InsertInstance): Promise<WhatsappInstance>;
  updateInstance(id: string, updates: Partial<InsertInstance>): Promise<WhatsappInstance>;
  updateInstanceQRCode(instanceId: string, qrCode: string): Promise<WhatsappInstance>;
  deleteInstance(id: string): Promise<void>;
  getWhatsappInstances(): Promise<WhatsappInstance[]>;
  getAllQueuedMessages(): Promise<MessageQueueItem[]>;
  getQueuedMessagesByUser(userId: string): Promise<MessageQueueItem[]>;
  
  // Plan limits
  getMonthlyMessageCount(clientId: string): Promise<number>;
  checkMessageLimits(clientId: string): Promise<{ allowed: boolean; limit: number; current: number; plan: string }>;
  
  // Template methods for metrics
  getTemplatesByClient(clientId: string): Promise<MessageTemplate[]>;
  
  // Template methods
  getTemplates(clientId: string, orderStatus?: string): Promise<MessageTemplate[]>;
  getTemplate(id: string): Promise<MessageTemplate | undefined>;
  createTemplate(template: InsertTemplate): Promise<MessageTemplate>;
  updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<MessageTemplate>;
  deleteTemplate(id: string): Promise<void>;
  
  // Webhook methods
  getWebhookConfig(clientId: string): Promise<WebhookConfig | undefined>;
  createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig>;
  updateWebhookConfig(id: string, updates: Partial<InsertWebhookConfig>): Promise<WebhookConfig>;
  getWebhookLogs(clientId: string, limit?: number): Promise<WebhookLog[]>;
  createWebhookLog(log: Omit<WebhookLog, 'id' | 'timestamp'>): Promise<WebhookLog>;
  
  // Message Queue methods
  getQueuedMessages(instanceId: string): Promise<MessageQueueItem[]>;
  createQueuedMessage(message: Omit<MessageQueueItem, 'id' | 'createdAt'>): Promise<MessageQueueItem>;
  updateQueuedMessage(id: string, updates: Partial<MessageQueueItem>): Promise<MessageQueueItem>;
  
  // Analytics methods
  getDashboardMetrics(userId: string): Promise<{
    activeClients: number;
    messagesSent: number;
    monthlyRevenue: number;
    deliveryRate: number;
  }>;
  
  // System Settings methods
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string, encrypted?: boolean, description?: string, updatedBy?: string): Promise<SystemSetting>;
  getSystemSettings(): Promise<SystemSetting[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId: customerId, 
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getClients(userId: string): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getInstances(clientId: string): Promise<WhatsappInstance[]> {
    return await db.select().from(whatsappInstances).where(eq(whatsappInstances.clientId, clientId));
  }

  async getAllInstances(userId: string): Promise<WhatsappInstance[]> {
    return await db
      .select({
        id: whatsappInstances.id,
        clientId: whatsappInstances.clientId,
        instanceId: whatsappInstances.instanceId,
        name: whatsappInstances.name,
        phoneNumber: whatsappInstances.phoneNumber,
        status: whatsappInstances.status,
        qrCode: whatsappInstances.qrCode,
        lastConnection: whatsappInstances.lastConnection,
        dailyMessages: whatsappInstances.dailyMessages,
        createdAt: whatsappInstances.createdAt,
      })
      .from(whatsappInstances)
      .innerJoin(clients, eq(whatsappInstances.clientId, clients.id))
      .where(eq(clients.userId, userId));
  }

  async getInstance(id: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.id, id));
    return instance || undefined;
  }

  async createInstance(instance: InsertInstance): Promise<WhatsappInstance> {
    const [newInstance] = await db.insert(whatsappInstances).values(instance).returning();
    return newInstance;
  }

  async updateInstance(id: string, updates: Partial<InsertInstance>): Promise<WhatsappInstance> {
    const [instance] = await db
      .update(whatsappInstances)
      .set(updates)
      .where(eq(whatsappInstances.id, id))
      .returning();
    return instance;
  }

  // Add method to reset daily messages for all instances at midnight
  async resetDailyMessagesForAllInstances(): Promise<void> {
    await db
      .update(whatsappInstances)
      .set({ dailyMessages: 0 })
      .where(gt(whatsappInstances.dailyMessages, 0));
    console.log('Daily messages reset for all instances');
  }

  async updateInstanceQRCode(instanceId: string, qrCode: string): Promise<WhatsappInstance> {
    const [instance] = await db
      .update(whatsappInstances)
      .set({ qrCode })
      .where(eq(whatsappInstances.instanceId, instanceId))
      .returning();
    return instance;
  }

  async deleteInstance(id: string): Promise<void> {
    await db.delete(whatsappInstances).where(eq(whatsappInstances.id, id));
  }

  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    return await db.select().from(whatsappInstances);
  }

  async getAllQueuedMessages(): Promise<MessageQueueItem[]> {
    console.log('Executing getAllQueuedMessages query...');
    const result = await db.select().from(messageQueue).orderBy(desc(messageQueue.createdAt));
    console.log(`Database returned ${result.length} messages`);
    return result;
  }

  async getQueuedMessagesByUser(userId: string): Promise<MessageQueueItem[]> {
    console.log(`Executing getQueuedMessagesByUser query for user: ${userId}...`);
    const result = await db
      .select({
        id: messageQueue.id,
        instanceId: messageQueue.instanceId,
        templateId: messageQueue.templateId,
        recipientPhone: messageQueue.recipientPhone,
        message: messageQueue.message,
        scheduledFor: messageQueue.scheduledFor,
        status: messageQueue.status,
        sentAt: messageQueue.sentAt,
        error: messageQueue.error,
        createdAt: messageQueue.createdAt,
      })
      .from(messageQueue)
      .innerJoin(whatsappInstances, eq(messageQueue.instanceId, whatsappInstances.id))
      .innerJoin(clients, eq(whatsappInstances.clientId, clients.id))
      .where(eq(clients.userId, userId))
      .orderBy(desc(messageQueue.createdAt));
    
    console.log(`Database returned ${result.length} messages for user ${userId}`);
    return result;
  }

  async getMonthlyMessageCount(clientId: string): Promise<number> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const result = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(messageQueue)
      .innerJoin(whatsappInstances, eq(messageQueue.instanceId, whatsappInstances.id))
      .where(
        and(
          eq(whatsappInstances.clientId, clientId),
          eq(messageQueue.status, 'sent'),
          gte(messageQueue.sentAt, firstDayOfMonth)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async checkMessageLimits(clientId: string): Promise<{ allowed: boolean; limit: number; current: number; plan: string }> {
    // Get client plan
    const client = await this.getClient(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    // Define plan limits
    const planLimits: Record<string, number> = {
      free: 30,
      basic: 1000,
      pro: 10000,
      enterprise: -1 // unlimited
    };

    const limit = planLimits[client.plan] || 30; // default to free plan limit
    const current = await this.getMonthlyMessageCount(clientId);
    
    return {
      allowed: limit === -1 || current < limit,
      limit,
      current,
      plan: client.plan
    };
  }

  async getTemplates(clientId: string, orderStatus?: string): Promise<MessageTemplate[]> {
    const conditions = orderStatus 
      ? and(eq(messageTemplates.clientId, clientId), eq(messageTemplates.orderStatus, orderStatus))
      : eq(messageTemplates.clientId, clientId);
    
    return await db
      .select()
      .from(messageTemplates)
      .where(conditions)
      .orderBy(messageTemplates.sequence);
  }

  async getTemplate(id: string): Promise<MessageTemplate | undefined> {
    const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return template || undefined;
  }

  async createTemplate(template: InsertTemplate): Promise<MessageTemplate> {
    const [newTemplate] = await db.insert(messageTemplates).values(template).returning();
    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<MessageTemplate> {
    const [template] = await db
      .update(messageTemplates)
      .set(updates)
      .where(eq(messageTemplates.id, id))
      .returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  }

  async getWebhookConfig(clientId: string): Promise<WebhookConfig | undefined> {
    const [config] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.clientId, clientId));
    return config || undefined;
  }

  async createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig> {
    const [newConfig] = await db.insert(webhookConfigs).values(config).returning();
    return newConfig;
  }

  async updateWebhookConfig(id: string, updates: Partial<InsertWebhookConfig>): Promise<WebhookConfig> {
    const [config] = await db
      .update(webhookConfigs)
      .set(updates)
      .where(eq(webhookConfigs.id, id))
      .returning();
    return config;
  }

  async getWebhookLogs(clientId: string, limit = 50): Promise<WebhookLog[]> {
    return await db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.clientId, clientId))
      .orderBy(desc(webhookLogs.timestamp))
      .limit(limit);
  }

  async createWebhookLog(log: Omit<WebhookLog, 'id' | 'timestamp'>): Promise<WebhookLog> {
    const [newLog] = await db.insert(webhookLogs).values({
      ...log,
      timestamp: new Date(),
    }).returning();
    return newLog;
  }

  async getQueuedMessages(instanceId: string): Promise<MessageQueueItem[]> {
    return await db
      .select()
      .from(messageQueue)
      .where(eq(messageQueue.instanceId, instanceId))
      .orderBy(messageQueue.scheduledFor);
  }

  async getQueuedMessage(id: string): Promise<MessageQueueItem | undefined> {
    const [message] = await db
      .select()
      .from(messageQueue)
      .where(eq(messageQueue.id, id))
      .limit(1);
    return message;
  }

  async createQueuedMessage(message: Omit<MessageQueueItem, 'id' | 'createdAt'>): Promise<MessageQueueItem> {
    const [newMessage] = await db.insert(messageQueue).values({
      ...message,
      createdAt: new Date(),
    }).returning();
    return newMessage;
  }

  async updateQueuedMessage(id: string, updates: Partial<MessageQueueItem>): Promise<MessageQueueItem> {
    const [message] = await db
      .update(messageQueue)
      .set(updates)
      .where(eq(messageQueue.id, id))
      .returning();
    return message;
  }

  async deleteQueuedMessage(id: string): Promise<void> {
    await db.delete(messageQueue).where(eq(messageQueue.id, id));
  }

  async getQueuedMessagesByOrderId(orderId: string): Promise<MessageQueueItem[]> {
    return await db.select()
      .from(messageQueue)
      .where(sql`message LIKE '%' || ${orderId} || '%'`);
  }

  async countMessagesUsingTemplate(templateId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageQueue)
      .where(eq(messageQueue.templateId, templateId));
    
    return result[0]?.count || 0;
  }

  async getDashboardMetrics(userId?: string): Promise<{
    activeClients: number;
    messagesSent: number;
    monthlyRevenue: number;
    deliveryRate: number;
  }> {
    const allClients = userId 
      ? await db.select().from(clients).where(eq(clients.userId, userId))
      : await db.select().from(clients);
      
    const activeClients = allClients.filter(c => c.status === 'active').length;
    
    // Calculate total messages sent this month
    const messagesSent = allClients.reduce((total, client) => total + (client.monthlyMessages || 0), 0);
    
    // Calculate monthly revenue (simplified calculation)
    const monthlyRevenue = allClients.reduce((total, client) => {
      const planRevenue = client.plan === 'pro' ? 89 : client.plan === 'enterprise' ? 199 : 29;
      return total + (client.status === 'active' ? planRevenue : 0);
    }, 0);
    
    // Calculate delivery rate (simplified - assume 98.5% for now)
    const deliveryRate = 98.5;
    
    return {
      activeClients,
      messagesSent,
      monthlyRevenue,
      deliveryRate,
    };
  }

  async getTemplatesByClient(clientId: string): Promise<MessageTemplate[]> {
    return await db.select().from(messageTemplates).where(eq(messageTemplates.clientId, clientId));
  }

  // System Settings methods
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSystemSetting(key: string, value: string, encrypted: boolean = false, description?: string, updatedBy?: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(systemSettings)
        .set({
          value,
          encrypted,
          description,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(systemSettings)
        .values({
          key,
          value,
          encrypted,
          description,
          updatedBy,
        })
        .returning();
      return created;
    }
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }
}

export const storage = new DatabaseStorage();
