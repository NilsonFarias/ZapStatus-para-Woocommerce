import axios, { AxiosInstance } from 'axios';

export interface EvolutionInstance {
  instanceName: string;
  status: string;
  serverUrl: string;
  apikey?: string;
}

export interface QRCodeResponse {
  qrcode: string;
  code?: string;
  message?: string;
  status?: string;
}

export interface InstanceInfo {
  instanceName: string;
  status: string;
  profileName?: string;
  profilePicUrl?: string;
  phoneNumber?: string;
}

export class EvolutionApiService {
  private client!: AxiosInstance;
  private baseUrl!: string;
  private apiKey!: string;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const storage = require('../storage').storage;
      const apiUrlSetting = await storage.getSystemSetting('evolution_api_url');
      const apiKeySetting = await storage.getSystemSetting('evolution_api_key');
      
      this.baseUrl = apiUrlSetting?.value || process.env.EVOLUTION_API_URL || 'https://api.evolution.com';
      this.apiKey = apiKeySetting?.value || process.env.EVOLUTION_API_KEY || '';
    } catch (error) {
      // Fallback to environment variables if database is not available
      this.baseUrl = process.env.EVOLUTION_API_URL || 'https://api.evolution.com';
      this.apiKey = process.env.EVOLUTION_API_KEY || '';
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // Method to refresh client configuration when settings change
  async refreshConfig() {
    await this.initializeClient();
  }

  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    try {
      console.log(`Creating Evolution API instance: ${instanceName}`);
      
      // Create instance without webhook initially (we'll set it later)
      const response = await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        msgCall: '',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false
      });
      
      console.log(`Instance created successfully: ${instanceName}`);
      
      // Configure webhook for the instance
      try {
        // Get system domain from database or fall back to environment variable
        const storage = require('../storage').storage;
        const systemDomainSetting = await storage.getSystemSetting('system_domain');
        const systemDomain = systemDomainSetting?.value || process.env.REPL_DOMAIN || 'http://localhost:5000';
        
        const webhookUrl = `${systemDomain}/webhook/evolution`;
        await this.client.post(`/webhook/set/${instanceName}`, {
          url: webhookUrl,
          enabled: true,
          events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
        });
        console.log(`Webhook configured for instance: ${instanceName}`);
      } catch (webhookError: any) {
        console.log(`Warning: Could not set webhook for ${instanceName}:`, webhookError.message);
        // Try alternative webhook configuration
        try {
          const webhookUrl = `${systemDomain}/webhook/evolution`;
          await this.client.post(`/webhook/${instanceName}`, {
            url: webhookUrl,
            enabled: true,
            events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE']
          });
          console.log(`Alternative webhook configured for instance: ${instanceName}`);
        } catch (altError: any) {
          console.log(`Alternative webhook also failed for ${instanceName}:`, altError.message);
        }
      }
      
      // Wait for instance to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start QR code polling since webhook might not work
      this.startQRPolling(instanceName);
      
      return response.data;
    } catch (error: any) {
      console.error('Error creating Evolution API instance:', error.message);
      console.error('Error details:', error.response?.data || error);
      throw new Error(`Failed to create instance: ${error.message}`);
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
    } catch (error: any) {
      console.error('Error deleting Evolution API instance:', error.message);
      throw new Error(`Failed to delete instance: ${error.message}`);
    }
  }

  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    try {
      console.log(`Getting QR code for instance: ${instanceName}`);
      
      // First check instance status
      try {
        const instances = await this.client.get('/instance/fetchInstances');
        const instance = instances.data.find((inst: any) => inst.name === instanceName);
        
        if (instance) {
          console.log(`Instance ${instanceName} status: ${instance.connectionStatus}`);
          
          if (instance.connectionStatus === 'open') {
            return {
              qrcode: '',
              message: 'Instance is already connected.',
              status: 'connected'
            };
          }
          
          // If instance is in 'close' state, it needs full restart for QR
          if (instance.connectionStatus === 'close') {
            console.log(`Instance ${instanceName} is closed, performing logout and reconnect...`);
            try {
              // First logout to clear any old sessions
              await this.client.delete(`/instance/logout/${instanceName}`);
              console.log(`Logout completed for ${instanceName}`);
              
              // Wait for logout to process
              await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (logoutError) {
              console.log('Logout error (may be expected):', logoutError);
            }
          }
        }
      } catch (statusError) {
        console.log('Could not check instance status:', statusError);
      }
      
      // Try multiple attempts to get QR code
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Attempt ${attempt}/3: Trying to get QR code for ${instanceName}...`);
        
        try {
          const response = await this.client.get(`/instance/connect/${instanceName}`);
          
          console.log(`Response for ${instanceName} (attempt ${attempt}):`, {
            status: response.status,
            hasData: !!response.data,
            dataType: typeof response.data,
            keys: response.data ? Object.keys(response.data) : [],
            qrcodePresent: !!(response.data && response.data.qrcode),
            base64Present: !!(response.data && response.data.base64),
            codePresent: !!(response.data && response.data.code),
            pairingCodePresent: !!(response.data && response.data.pairingCode),
            base64Length: response.data && response.data.base64 ? response.data.base64.length : 0,
            codeLength: response.data && response.data.code ? response.data.code.length : 0,
            pairingCodeLength: response.data && response.data.pairingCode ? response.data.pairingCode.length : 0,
          });
          
          // Check for base64 QR code (Evolution API format)
          if (response.data && response.data.base64) {
            let qrCodeData = response.data.base64;
            
            // Add data URI prefix if not present
            if (!qrCodeData.startsWith('data:image')) {
              qrCodeData = `data:image/png;base64,${qrCodeData}`;
            }
            
            console.log(`✓ QR code found for ${instanceName} on attempt ${attempt} (length: ${qrCodeData.length})`);
            
            // Start polling for status updates
            this.startQRPolling(instanceName);
            
            return {
              qrcode: qrCodeData,
              message: 'QR code ready for scanning',
              status: 'connecting'
            };
          }
          
          // Check for regular qrcode field
          if (response.data && response.data.qrcode) {
            console.log(`✓ QR code found (qrcode field) for ${instanceName} on attempt ${attempt}`);
            return {
              qrcode: response.data.qrcode,
              message: 'QR code ready for scanning',
              status: 'connecting'
            };
          }
          
          // If no QR code yet, wait before next attempt
          if (attempt < 3) {
            console.log(`No QR code on attempt ${attempt}, waiting 4 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 4000));
          }
          
        } catch (attemptError: any) {
          console.log(`Attempt ${attempt} failed:`, attemptError.response?.data || attemptError.message);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      // Check if instance has been connecting for too long
      const connectingTime = this.getConnectingTime(instanceName);
      if (connectingTime > 5) { // 5 minutes
        console.log(`Instance ${instanceName} has been connecting for ${connectingTime.toFixed(1)} minutes`);
        
        if (connectingTime > 10) { // 10 minutes - consider it stuck
          return {
            qrcode: '',
            message: 'Instance appears to be stuck. Please delete and create a new instance.',
            status: 'stuck'
          };
        }
        
        return {
          qrcode: '',
          message: 'Instance is still initializing. Please wait a few more minutes and try again.',
          status: 'connecting'
        };
      }
      
      return {
        qrcode: '',
        message: 'Unable to generate QR code after multiple attempts. The instance may need to be recreated.',
        status: 'error'
      };
      
    } catch (error: any) {
      console.error('Error getting QR code:', error.message);
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }

  async getInstanceInfo(instanceName: string): Promise<InstanceInfo> {
    try {
      // Get all instances and find the specific one
      const response = await this.client.get('/instance/fetchInstances');
      const instances = response.data;
      const instance = instances.find((inst: any) => inst.name === instanceName);
      
      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }
      
      return {
        instanceName: instance.name,
        status: instance.connectionStatus,
        profileName: instance.profileName,
        profilePicUrl: instance.profilePicUrl,
        phoneNumber: instance.number
      };
    } catch (error: any) {
      console.error('Error getting instance info:', error.message);
      throw new Error(`Failed to get instance info: ${error.message}`);
    }
  }

  async sendMessage(instanceName: string, phone: string, message: string): Promise<void> {
    try {
      console.log(`Sending message via ${instanceName} to ${phone}:`, message);
      
      const payload = {
        number: phone,
        text: message,
      };
      
      console.log('Message payload:', JSON.stringify(payload, null, 2));
      
      const response = await this.client.post(`/message/sendText/${instanceName}`, payload);
      
      console.log('Message sent successfully:', response.status);
      
      // Increment daily message count for this instance
      await this.incrementDailyMessages(instanceName);
      
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
  }

  private async incrementDailyMessages(instanceName: string): Promise<void> {
    try {
      // Import storage dynamically to avoid circular dependency
      const { storage } = await import('../storage');
      
      // Find instance by instanceId
      const instances = await storage.getAllInstances("68a6ee4a-0647-447d-913f-2bed17557e96"); // Admin user
      const instance = instances.find(inst => inst.instanceId === instanceName);
      
      if (instance) {
        const today = new Date().toDateString();
        const lastConnectionDate = instance.lastConnection ? new Date(instance.lastConnection).toDateString() : null;
        
        // Reset daily count if it's a new day
        let newDailyCount = (instance.dailyMessages || 0);
        if (lastConnectionDate !== today) {
          newDailyCount = 1; // First message of the day
        } else {
          newDailyCount += 1; // Increment existing count
        }
        
        await storage.updateInstance(instance.id, { 
          dailyMessages: newDailyCount,
          lastConnection: new Date() // Update last activity
        });
        
        console.log(`Daily message count updated for ${instanceName}: ${newDailyCount}`);
      }
    } catch (error) {
      console.error('Error incrementing daily messages:', error);
      // Don't throw error - message sending should succeed even if counting fails
    }
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/logout/${instanceName}`);
    } catch (error: any) {
      console.error('Error disconnecting instance:', error.message);
      throw new Error(`Failed to disconnect instance: ${error.message}`);
    }
  }

  async restartInstance(instanceName: string): Promise<void> {
    try {
      console.log(`Restarting instance ${instanceName}...`);
      
      // Try direct restart approach first
      try {
        const response = await this.client.post(`/instance/restart/${instanceName}`);
        console.log(`Instance ${instanceName} restarted successfully via restart endpoint`);
        return;
      } catch (restartError) {
        console.log(`Direct restart failed, trying disconnect/connect approach...`);
      }
      
      // Fallback: disconnect then connect
      console.log(`Disconnecting instance ${instanceName}...`);
      await this.client.delete(`/instance/logout/${instanceName}`);
      
      // Wait for disconnect to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reconnect
      console.log(`Reconnecting instance ${instanceName}...`);
      await this.client.get(`/instance/connect/${instanceName}`);
      
      console.log(`Instance ${instanceName} restarted successfully via disconnect/connect`);
    } catch (error: any) {
      console.error('Error restarting instance:', error.response?.data || error.message);
      throw new Error(`Failed to restart instance: ${error.response?.data?.message || error.message}`);
    }
  }

  async getAllInstances(): Promise<any[]> {
    try {
      const response = await this.client.get('/instance/fetchInstances');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching instances:', error.message);
      throw new Error(`Failed to fetch instances: ${error.message}`);
    }
  }

  async connectInstance(instanceName: string): Promise<any> {
    try {
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error: any) {
      console.error('Error connecting instance:', error.message);
      throw new Error(`Failed to connect instance: ${error.message}`);
    }
  }

  // Start polling for QR code when webhook is not available
  private startQRPolling(instanceName: string) {
    console.log(`Starting QR code polling for ${instanceName}`);
    
    let pollCount = 0;
    const maxPolls = 20; // Poll for up to 2 minutes (20 * 6 seconds)
    
    // Use setTimeout instead of setInterval for better error handling
    const pollFunction = async () => {
      pollCount++;
      
      try {
        console.log(`Polling attempt ${pollCount}/${maxPolls} for ${instanceName}...`);
        const response = await this.client.get(`/instance/connect/${instanceName}`);
        
        // Log the complete response to investigate QR code structure
        console.log(`Raw response data for ${instanceName}:`, JSON.stringify(response.data, null, 2));
        
        console.log(`Response for ${instanceName}:`, {
          status: response.status,
          hasData: !!response.data,
          dataType: typeof response.data,
          keys: response.data ? Object.keys(response.data) : [],
          qrcodePresent: !!(response.data && response.data.qrcode),
          base64Present: !!(response.data && response.data.base64),
          codePresent: !!(response.data && response.data.code),
          pairingCodePresent: !!(response.data && response.data.pairingCode),
          base64Length: response.data?.base64?.length || 0,
          codeLength: response.data?.code?.length || 0,
          pairingCodeLength: response.data?.pairingCode?.length || 0,
          base64Value: response.data?.base64 ? response.data.base64.substring(0, 50) + '...' : 'empty',
          codeValue: response.data?.code ? response.data.code.substring(0, 50) + '...' : 'empty',
          pairingCodeValue: response.data?.pairingCode ? response.data.pairingCode.substring(0, 50) + '...' : 'empty'
        });
        
        // Check for QR code in different possible fields
        let qrCodeData = null;
        if (response.data) {
          if (response.data.qrcode) {
            qrCodeData = response.data.qrcode;
          } else if (response.data.base64) {
            qrCodeData = response.data.base64;
          } else if (response.data.code) {
            qrCodeData = response.data.code;
          }
        }
        
        if (qrCodeData) {
          console.log(`✓ QR code found via polling for ${instanceName} (length: ${qrCodeData.length})`);
          
          // Save QR code to database immediately
          try {
            const { storage } = await import('../storage.js');
            await storage.updateInstanceQRCode(instanceName, qrCodeData);
            console.log(`✓ QR code saved to database for ${instanceName}`);
          } catch (dbError: any) {
            console.log('⚠ Failed to save QR code to database:', dbError.message);
          }
          
          // Emit QR code via Socket.IO
          try {
            // Import the routes module properly
            const { getGlobalSocketServer } = await import('../routes.js');
            const io = getGlobalSocketServer();
            if (io) {
              io.to(`instance_${instanceName}`).emit('qr_code', {
                instance: instanceName,
                qrCode: qrCodeData
              });
              console.log(`✓ QR code emitted via Socket.IO for ${instanceName}`);
            } else {
              console.log('⚠ Socket.IO server not found, but QR code saved to database');
            }
          } catch (ioError: any) {
            console.log('⚠ Socket.IO error, but QR code saved to database:', ioError.message);
          }
          
          return; // Stop polling
        }
        
        // Check if instance is connected
        const instanceInfo = await this.getInstanceInfo(instanceName);
        if (instanceInfo.status === 'open') {
          console.log(`✓ Instance ${instanceName} is now connected, stopping QR polling`);
          
          try {
            const { getGlobalSocketServer } = await import('../routes.js');
            const io = getGlobalSocketServer();
            if (io) {
              io.to(`instance_${instanceName}`).emit('connection_update', {
                instance: instanceName,
                status: 'connected'
              });
            }
          } catch (ioError: any) {
            console.log('⚠ Socket.IO not available, connection update not emitted');
          }
          
          return; // Stop polling
        }
        
        if (pollCount >= maxPolls) {
          console.log(`⏰ QR polling timeout for ${instanceName} after ${maxPolls} attempts`);
          return; // Stop polling
        }
        
        // Continue polling
        setTimeout(pollFunction, 6000); // Poll again in 6 seconds
        
      } catch (error: any) {
        console.log(`❌ QR polling error for ${instanceName}:`, error.message);
        
        if (pollCount >= maxPolls) {
          console.log(`⏰ QR polling stopped for ${instanceName} due to max attempts`);
          return;
        }
        
        // Continue polling even on errors
        setTimeout(pollFunction, 6000);
      }
    };
    
    // Start first poll immediately
    setTimeout(pollFunction, 1000); // Start after 1 second
  }
}

export const evolutionApi = new EvolutionApiService();
