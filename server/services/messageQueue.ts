import cron from 'node-cron';
import { storage } from '../storage';
import { evolutionApi } from './evolutionApi';

export class MessageQueueService {
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Run every minute to check for scheduled messages
    cron.schedule('* * * * *', async () => {
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
      
      // This is a simplified approach - in a real implementation, you'd want to
      // query the database more efficiently
      const instances = await storage.getAllInstances(''); // We'd need to modify this
      
      for (const instance of instances) {
        const queuedMessages = await storage.getQueuedMessages(instance.id);
        
        for (const message of queuedMessages) {
          if (message.status === 'pending' && message.scheduledFor <= now) {
            await this.sendQueuedMessage(message.id, instance.instanceId);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
    }
  }

  private async sendQueuedMessage(messageId: string, instanceName: string) {
    try {
      const message = await storage.updateQueuedMessage(messageId, {
        status: 'sending'
      });

      await evolutionApi.sendMessage(
        instanceName, 
        message.recipientPhone, 
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
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);

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
