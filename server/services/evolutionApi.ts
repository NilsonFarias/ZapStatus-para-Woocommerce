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
      
      // Try multiple attempts to get QR code
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Attempting to get QR code for ${instanceName}, attempt ${attempts}/${maxAttempts}`);
          
          const response = await this.client.get(`/instance/connect/${instanceName}`);
          
          // Check if QR code is available
          if (response.data && response.data.qrcode) {
            console.log(`QR code successfully retrieved for ${instanceName}`);
            return {
              qrcode: response.data.qrcode,
              status: 'qr_ready'
            };
          }
          
          // If no QR code and not last attempt, wait and retry
          if (attempts < maxAttempts) {
            console.log(`No QR code yet, waiting 2 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (requestError: any) {
          console.log(`Request error on attempt ${attempts}: ${requestError.message}`);
          if (attempts === maxAttempts) {
            throw requestError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If QR code is still not available after all attempts
      if (instanceInfo.status === 'connecting') {
        return {
          qrcode: '',
          message: 'Instance is still connecting. Please wait a bit longer and try again.',
          status: 'connecting'
        };
      }
      
      return {
        qrcode: '',
        message: 'QR code not available. The instance may need more time to initialize.',
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
