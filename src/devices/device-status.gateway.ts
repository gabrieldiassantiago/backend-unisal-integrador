import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface DeviceStatusUpdate {
  deviceId: string;
  deviceIdentifier: string;
  patientId: string;
  isOnline: boolean;
  batteryLevel?: number;
  signalStrength?: number;
  lastHeartbeatAt?: Date;
  status: string;
}

@WebSocketGateway({
  namespace: 'device-status',
  path: '/ws/device-status',
  cors: { origin: '*' ,
    credentials: true,
  },
})
export class DeviceStatusGateway
  implements OnGatewayConnection, OnGatewayInit
{
  @WebSocketServer() server: Server;

  afterInit() {
    console.log('🔌 DeviceStatusGateway initialized');
    this.server?.emit('gatewayReady', { ok: true });
  }

  handleConnection(client: Socket) {
    console.log(`\n📱 ================================`);
    console.log(`📱 Client connected to device-status`);
    console.log(`📱 Client ID: ${client.id}`);
    console.log(`📱 Namespace: ${client.nsp.name}`);
    console.log(`📱 ================================\n`);
  }

  handleDisconnect(client: Socket) {
    console.log(`\n📱 ================================`);
    console.log(`📱 Client disconnected from device-status`);
    console.log(`📱 Client ID: ${client.id}`);
    console.log(`📱 ================================\n`);
  }

  /**
   * Permite que o app mobile/web se inscreva para receber 
   * atualizações de status de um paciente específico
   */
  @SubscribeMessage('joinPatient')
  async handleJoinPatient(
    @MessageBody() patientId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `patient_${patientId}`;
    client.join(roomName);

    console.log(`\n👤 ================================`);
    console.log(`👤 JOIN PATIENT DEVICES`);
    console.log(`👤 Client: ${client.id}`);
    console.log(`👤 PatientId: ${patientId}`);
    console.log(`👤 Sala: ${roomName}`);

    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;
    console.log(`👤 Clientes na sala: ${clientCount}`);
    console.log(`👤 ================================\n`);
  }

  /**
   * Permite que o app se inscreva para um dispositivo específico
   */
  
  @SubscribeMessage('joinDevice')
  async handleJoinDevice(
    @MessageBody() deviceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `device_${deviceId}`;
    client.join(roomName);

    console.log(`\n📟 ================================`);
    console.log(`📟 JOIN DEVICE`);
    console.log(`📟 Client: ${client.id}`);
    console.log(`📟 DeviceId: ${deviceId}`);
    console.log(`📟 Sala: ${roomName}`);
    console.log(`📟 ================================\n`);
  }

  /**
   * Emite atualização de status do dispositivo
   * Para todos os clientes inscritos no paciente
   */

  async emitDeviceStatusUpdate(data: DeviceStatusUpdate) {
    const patientRoom = `patient_${data.patientId}`;
    const deviceRoom = `device_${data.deviceId}`;

    console.log(`\n📊 ================================`);
    console.log(`📊 EMITINDO deviceStatusUpdate`);
    console.log(`📊 Device: ${data.deviceIdentifier}`);
    console.log(`📊 Patient: ${data.patientId}`);
    console.log(`📊 Online: ${data.isOnline}`);
    console.log(`📊 Battery: ${data.batteryLevel}%`);
    console.log(`📊 Signal: ${data.signalStrength} dBm`);

    // Emite para todos os clientes do paciente
    this.server?.to(patientRoom).emit('deviceStatusUpdate', data);
    
    // Emite também para quem está escutando o device específico
    this.server?.to(deviceRoom).emit('deviceStatusUpdate', data);

    const sockets = await this.server?.in(patientRoom).fetchSockets();
    console.log(`📊 Clientes notificados: ${sockets?.length ?? 0}`);
    console.log(`📊 ================================\n`);
  }

  /**
   * Emite quando um dispositivo fica offline
   */

  async emitDeviceOffline(data: { deviceId: string; deviceIdentifier: string; patientId: string }) {
    const patientRoom = `patient_${data.patientId}`;
    const deviceRoom = `device_${data.deviceId}`;

    console.log(`\n🔴 ================================`);
    console.log(`🔴 DEVICE OFFLINE`);
    console.log(`🔴 Device: ${data.deviceIdentifier}`);
    console.log(`🔴 Patient: ${data.patientId}`);
    console.log(`🔴 ================================\n`);

    const offlineData = {
      ...data,
      isOnline: false,
      timestamp: new Date(),
    };

    this.server?.to(patientRoom).emit('deviceOffline', offlineData);
    this.server?.to(deviceRoom).emit('deviceOffline', offlineData);
  }

  /**
   * Emite quando um dispositivo volta online
   */

  async emitDeviceOnline(data: DeviceStatusUpdate) {
    const patientRoom = `patient_${data.patientId}`;
    const deviceRoom = `device_${data.deviceId}`;

    console.log(`\n🟢 ================================`);
    console.log(`🟢 DEVICE ONLINE`);
    console.log(`🟢 Device: ${data.deviceIdentifier}`);
    console.log(`🟢 Patient: ${data.patientId}`);
    console.log(`🟢 ================================\n`);

    const onlineData = {
      ...data,
      isOnline: true,
      timestamp: new Date(),
    };

    this.server?.to(patientRoom).emit('deviceOnline', onlineData);
    this.server?.to(deviceRoom).emit('deviceOnline', onlineData);
  }
}
