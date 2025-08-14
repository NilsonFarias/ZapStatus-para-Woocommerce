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
      
      // Create instance using correct Evolution API format
      const response = await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      
      console.log(`Instance created successfully: ${instanceName}`);
      
      // Wait for instance to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
}

export const evolutionApi = new EvolutionApiService();
