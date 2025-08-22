import cron from 'node-cron';
import { storage } from '../storage';
import { evolutionApi } from './evolutionApi';

export class MessageQueueService {
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Run every 10 seconds to check for scheduled messages
    cron.schedule('*/10 * * * * *', async () => {
      await this.processQueuedMessages();
    });
    
    console.log('Message queue service started');
  }

  stop() {
    this.isRunning = false;
  }

  private async processQueuedMessages() {
    try {
      // Get all pending messages that are scheduled for now or earlier
      const now = new Date();
      console.log(`Checking for pending messages at ${now.toISOString()}`);
      
      // Get all pending messages directly
      const allMessages = await storage.getAllQueuedMessages();
      const pendingMessages = allMessages.filter(msg => 
        msg.status === 'pending' && new Date(msg.scheduledFor) <= now
      );
      
      console.log(`Found ${pendingMessages.length} pending messages to process`);
      
      for (const message of pendingMessages) {
        // Get the instance for this message
        const instance = await storage.getInstance(message.instanceId);
        if (instance) {
          console.log(`Processing pending message ${message.id} for instance ${instance.instanceId}`);
          await this.sendQueuedMessage(message.id, instance.instanceId);
        } else {
          console.error(`Instance not found for message ${message.id}`);
        }
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
    }
  }

  async sendQueuedMessage(messageId: string, instanceName: string) {
    try {
      const message = await storage.updateQueuedMessage(messageId, {
        status: 'sending'
      });

      // Clean phone number format before sending
      let cleanPhone = message.recipientPhone.replace(/\D/g, ''); // Remove all non-digits
      if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
        cleanPhone = '55' + cleanPhone;
      }
      const formattedPhone = cleanPhone;
      
      console.log(`Sending message to ${formattedPhone} (cleaned from ${message.recipientPhone})`);
      
      await evolutionApi.sendMessage(
        instanceName, 
        formattedPhone, 
        message.message
      );

      await storage.updateQueuedMessage(messageId, {
        status: 'sent',
        sentAt: new Date()
      });

      console.log(`Message ${messageId} sent successfully`);
    } catch (error: any) {
      await storage.updateQueuedMessage(messageId, {
        status: 'failed',
        error: error.message
      });

      console.error(`Failed to send message ${messageId}:`, error.message);
    }
  }

  async scheduleMessage(
    instanceId: string,
    templateId: string,
    recipientPhone: string,
    message: string,
    delayMinutes = 0
  ) {
    // Get instance to find the client
    const instance = await storage.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Create unique hash to prevent duplicates
    const crypto = require('crypto');
    const messageHash = crypto.createHash('md5')
      .update(`${instanceId}-${templateId}-${recipientPhone}-${message}`)
      .digest('hex');
    
    // Check if a similar message was scheduled recently (within 5 minutes)
    const recentMessages = await storage.getAllQueuedMessages();
    const recentDuplicate = recentMessages.find(msg => {
      const msgTime = new Date(msg.scheduledFor);
      const timeDiff = Math.abs(new Date().getTime() - msgTime.getTime());
      const isSameContent = msg.instanceId === instanceId && 
                          msg.templateId === templateId && 
                          msg.recipientPhone === recipientPhone &&
                          msg.message === message;
      return isSameContent && timeDiff < 5 * 60 * 1000; // 5 minutes
    });
    
    if (recentDuplicate) {
      console.log(`🚫 Duplicate message detected and prevented: ${messageHash.substring(0, 8)}`);
      return recentDuplicate; // Return existing message instead of creating duplicate
    }

    // Check message limits for this client
    const limits = await storage.checkMessageLimits(instance.clientId);
    if (!limits.allowed) {
      throw new Error(`Limite de mensagens atingido para o plano ${limits.plan}. Limite: ${limits.limit === -1 ? 'ilimitado' : limits.limit}/mês, Atual: ${limits.current}`);
    }

    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);

    console.log(`✅ Scheduling new message: ${messageHash.substring(0, 8)}`);
    
    return await storage.createQueuedMessage({
      instanceId,
      templateId,
      recipientPhone,
      message,
      scheduledFor,
      status: 'pending',
      sentAt: null,
      error: null,
    });
  }

  async scheduleMessageInSeconds(
    instanceId: string,
    templateId: string,
    recipientPhone: string,
    message: string,
    delaySeconds = 0
  ) {
    const scheduledFor = new Date();
    scheduledFor.setSeconds(scheduledFor.getSeconds() + delaySeconds);

    return await storage.createQueuedMessage({
      instanceId,
      templateId,
      recipientPhone,
      message,
      scheduledFor,
      status: 'pending',
      sentAt: null,
      error: null,
    });
  }
}

export const messageQueue = new MessageQueueService();
