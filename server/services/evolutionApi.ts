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
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || 'https://api.evolution.com';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
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
        const webhookUrl = `${process.env.REPL_DOMAIN || 'http://localhost:5000'}/webhook/evolution`;
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
      // First check if instance exists and its status
      const instanceInfo = await this.getInstanceInfo(instanceName);
      
      console.log(`Instance ${instanceName} status: ${instanceInfo.status}`);
      
      // If instance is already connected, return appropriate message
      if (instanceInfo.status === 'open') {
        return {
          qrcode: '',
          message: 'Instance is already connected to WhatsApp',
          status: 'connected'
        };
      }
      
      // Try to get QR code directly
      try {
        console.log(`Trying to get QR code for ${instanceName}...`);
        const response = await this.client.get(`/instance/connect/${instanceName}`);
        
        if (response.data && response.data.qrcode) {
          console.log(`QR code successfully retrieved for ${instanceName}`);
          return {
            qrcode: response.data.qrcode,
            status: 'qr_ready'
          };
        }
        console.log(`No QR code in response for ${instanceName}`);
      } catch (requestError: any) {
        console.log(`Error getting QR code: ${requestError.message}`);
      }
      
      // Check if instance has been connecting for too long and try to fix it
      if (instanceInfo.status === 'connecting') {
        const allInstancesResponse = await this.client.get('/instance/fetchInstances');
        const instance = allInstancesResponse.data.find((inst: any) => inst.name === instanceName);
        
        if (instance) {
          const createdAt = new Date(instance.createdAt);
          const now = new Date();
          const timeDiff = (now.getTime() - createdAt.getTime()) / 1000 / 60; // in minutes
          
          console.log(`Instance ${instanceName} has been connecting for ${timeDiff.toFixed(1)} minutes`);
          
          // If connecting for more than 3 minutes, try logout to reset
          if (timeDiff > 3) {
            console.log(`Instance ${instanceName} seems stuck, trying logout...`);
            try {
              await this.client.delete(`/instance/logout/${instanceName}`);
              console.log(`Logout successful for ${instanceName}, waiting 5 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Try to get QR code again after logout
              const response = await this.client.get(`/instance/connect/${instanceName}`);
              if (response.data && response.data.qrcode) {
                console.log(`QR code retrieved for ${instanceName} after logout!`);
                return {
                  qrcode: response.data.qrcode,
                  status: 'qr_ready'
                };
              }
            } catch (logoutError: any) {
              console.log(`Logout failed for ${instanceName}: ${logoutError.message}`);
            }
          }
          
          // If connecting for more than 8 minutes, suggest deletion
          if (timeDiff > 8) {
            return {
              qrcode: '',
              message: 'Instance appears to be stuck. Please delete and create a new instance.',
              status: 'stuck'
            };
          }
        }
        
        return {
          qrcode: '',
          message: 'Instance is still initializing. Please wait a few more minutes and try again.',
          status: 'connecting'
        };
      }
      
      return {
        qrcode: '',
        message: 'QR code not available. The Evolution API server may be having issues generating QR codes. Try creating a new instance.',
        status: 'waiting'
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
      await this.client.post(`/message/sendText/${instanceName}`, {
        number: phone,
        text: message,
      });
    } catch (error: any) {
      console.error('Error sending message:', error.message);
      throw new Error(`Failed to send message: ${error.message}`);
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
      await this.client.put(`/instance/restart/${instanceName}`);
    } catch (error: any) {
      console.error('Error restarting instance:', error.message);
      throw new Error(`Failed to restart instance: ${error.message}`);
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
