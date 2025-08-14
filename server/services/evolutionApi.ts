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
      const instanceInfo = await this.client.get(`/instance/fetchInstances/${instanceName}`);
      const instance = instanceInfo.data;
      
      if (!instance) {
        throw new Error('Instance not found');
      }
      
      console.log(`Instance ${instanceName} status: ${instance.connectionStatus}`);
      
      // Try to get QR code
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      
      // If QR code is empty, the instance might be connecting or already connected
      if (!response.data.qrcode && instance.connectionStatus === 'connecting') {
        return {
          qrcode: '',
          message: 'Instance is connecting, please wait and try again...',
          status: 'connecting'
        };
      }
      
      if (!response.data.qrcode && instance.connectionStatus === 'open') {
        return {
          qrcode: '',
          message: 'Instance is already connected to WhatsApp',
          status: 'connected'
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error getting QR code:', error.message);
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }

  async getInstanceInfo(instanceName: string): Promise<InstanceInfo> {
    try {
      const response = await this.client.get(`/instance/fetchInstances/${instanceName}`);
      return response.data;
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
