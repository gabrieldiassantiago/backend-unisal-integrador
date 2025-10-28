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

@WebSocketGateway({
  namespace: 'fall-alerts',
  path: '/ws/fall-alerts',
  cors: { origin: '*' },
})
export class FallAlertsGateway
  implements OnGatewayConnection, OnGatewayInit
{
  @WebSocketServer() server: Server;

  afterInit() {
    // Safe point: server is now assigned
    this.server?.emit('gatewayReady', { ok: true });
  }

  handleConnection(client: Socket) {
    console.log(`\n🔌 ================================`);
    console.log(`🔌 Client connected: ${client.id}`);
    console.log(`🔌 Namespace: ${client.nsp.name}`);
    console.log(`🔌 ================================\n`);
  }

  handleDisconnect(client: Socket) {
    console.log(`\n🔌 ================================`);
    console.log(`🔌 Client disconnected: ${client.id}`);
    console.log(`🔌 ================================\n`);
  }

  @SubscribeMessage('joinPatient')
  async handleJoin(
    @MessageBody() patientId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `patient_${patientId}`;
    client.join(roomName);

    console.log(`\n👤 ================================`);
    console.log(`👤 JOIN PATIENT`);
    console.log(`👤 Client: ${client.id}`);
    console.log(`👤 PatientId: ${patientId}`);
    console.log(`👤 Sala: ${roomName}`);

    // Use official API instead of adapter.rooms
    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;
    console.log(`👤 Clientes na sala: ${clientCount}`);
    if (clientCount > 0) {
      console.log(`👤 IDs dos clientes:`);
      sockets!.forEach((s, index) => console.log(`   ${index + 1}. ${s.id}`));
    }
    console.log(`👤 ================================\n`);
  }

  async emitNewAlert(alert: any) {
    const roomName = `patient_${alert.patientId}`;

    console.log(`\n🚨 ================================`);
    console.log(`🚨 EMITINDO newAlert`);
    console.log(`🚨 patientId: ${alert.patientId}`);
    console.log(`🚨 alertId: ${alert.id}`);
    console.log(`🚨 Sala: ${roomName}`);

    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;
    console.log(`🚨 Clientes na sala: ${clientCount}`);
    if (clientCount === 0) {
      console.log(`⚠️ ATENÇÃO: Nenhum cliente conectado na sala!`);
    }

    this.server?.to(roomName).emit('newAlert', alert);
    console.log(`🚨 Evento emitido!`);
    console.log(`🚨 ================================\n`);
  }

  async emitConfirmed(alert: any) {
    const roomName = `patient_${alert.patientId}`;
    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;

    console.log(`\n✅ ================================`);
    console.log(`✅ EMITINDO alertConfirmed`);
    console.log(`✅ patientId: ${alert.patientId}`);
    console.log(`✅ alertId: ${alert.id}`);
    console.log(`✅ Sala: ${roomName}`);
    console.log(`✅ Clientes na sala: ${clientCount}`);

    this.server?.to(roomName).emit('alertConfirmed', alert);
    console.log(`✅ Evento emitido!`);
    console.log(`✅ ================================\n`);
  }

  async emitAlertStatusChange(data: any) {
    const roomName = `patient_${data.patientId}`;
    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;

    console.log(`\n🔄 ================================`);
    console.log(`🔄 EMITINDO alertStatusChanged`);
    console.log(`🔄 patientId: ${data.patientId}`);
    console.log(`🔄 alertId: ${data.id}`);
    console.log(`🔄 status: ${data.status}`);
    console.log(`🔄 Sala: ${roomName}`);
    console.log(`🔄 Clientes na sala: ${clientCount}`);

    if (clientCount === 0) console.log(`⚠️ ATENÇÃO: Nenhum cliente conectado na sala!`);

    this.server?.to(roomName).emit('alertStatusChanged', data);
    console.log(`🔄 Evento emitido!`);
    console.log(`🔄 ================================\n`);
  }

  async emitRequestConfirmation(data: any) {
    const roomName = `patient_${data.patientId}`;

    console.log(`\n🔔 ================================`);
    console.log(`🔔 EMITINDO requestConfirmation`);
    console.log(`🔔 patientId: ${data.patientId}`);
    console.log(`🔔 alertId: ${data.alertId || data.id}`);
    console.log(`🔔 Sala: ${roomName}`);
    console.log(`🔔 Payload completo:`, JSON.stringify(data, null, 2));

    const sockets = await this.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;
    console.log(`🔔 Clientes na sala: ${clientCount}`);

    if (clientCount === 0) {
      console.log(`⚠️ ATENÇÃO: Nenhum cliente conectado na sala!`);
    } else {
      console.log(`🔔 IDs dos clientes que receberão o evento:`);
      sockets!.forEach((s, index) => console.log(`   ${index + 1}. ${s.id}`));
    }

    this.server?.to(roomName).emit('requestConfirmation', data);
    console.log(`🔔 Evento emitido!`);
    console.log(`🔔 ================================\n`);
  }
}
