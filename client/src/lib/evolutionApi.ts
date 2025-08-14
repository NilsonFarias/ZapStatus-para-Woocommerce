export interface CreateInstanceRequest {
  name: string;
  clientId: string;
}

export interface QRCodeResponse {
  qrcode: string;
  instanceId: string;
}

export interface InstanceStatus {
  status: 'connected' | 'disconnected' | 'connecting';
  phoneNumber?: string;
}
