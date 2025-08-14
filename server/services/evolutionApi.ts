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
      const response = await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error creating Evolution API instance:', error.message);
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
      
      // Check if instance has been connecting for too long (more than 10 minutes)
      if (instanceInfo.status === 'connecting') {
        // Get all instances to check creation time
        const allInstancesResponse = await this.client.get('/instance/fetchInstances');
        const instance = allInstancesResponse.data.find((inst: any) => inst.name === instanceName);
        
        if (instance) {
          const createdAt = new Date(instance.createdAt);
          const now = new Date();
          const timeDiff = (now.getTime() - createdAt.getTime()) / 1000 / 60; // in minutes
          
          console.log(`Instance ${instanceName} has been connecting for ${timeDiff.toFixed(1)} minutes`);
          
          // If connecting for more than 10 minutes, it's likely stuck
          if (timeDiff > 10) {
            console.log(`Instance ${instanceName} appears to be stuck, suggesting restart`);
            return {
              qrcode: '',
              message: 'Instance appears to be stuck. Please delete and create a new instance.',
              status: 'stuck'
            };
          }
        }
        
        // For fresh connecting instances, try a few quick attempts
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            attempts++;
            console.log(`Quick attempt ${attempts}/${maxAttempts} for connecting instance ${instanceName}`);
            
            const response = await this.client.get(`/instance/connect/${instanceName}`);
            
            if (response.data && response.data.qrcode) {
              console.log(`QR code found for ${instanceName}!`);
              return {
                qrcode: response.data.qrcode,
                status: 'qr_ready'
              };
            }
            
            // Short wait between attempts
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (requestError: any) {
            console.log(`Request error on attempt ${attempts}: ${requestError.message}`);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        return {
          qrcode: '',
          message: 'Instance is still initializing. Please wait a few more minutes and try again.',
          status: 'connecting'
        };
      }
      
      // For other statuses, try once
      try {
        const response = await this.client.get(`/instance/connect/${instanceName}`);
        if (response.data && response.data.qrcode) {
          return {
            qrcode: response.data.qrcode,
            status: 'qr_ready'
          };
        }
      } catch (requestError: any) {
        console.log(`Request error: ${requestError.message}`);
      }
      
      return {
        qrcode: '',
        message: 'QR code not available at this moment.',
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
}

export const evolutionApi = new EvolutionApiService();
