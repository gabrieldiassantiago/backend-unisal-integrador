import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';

@WebSocketGateway({
  namespace: 'fall-alerts',
  path: '/ws/fall-alerts',
  cors: { origin: '*' },
})
export class FallAlertsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinPatient')
  handleJoin(
    @MessageBody() patientId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`patient_${patientId}`);
  }

  emitNewAlert(alert: any) {
    this.server
      .to(`patient_${alert.patientId}`)
      .emit('newAlert', alert);
  }

  emitConfirmed(alert: any) {
    this.server
      .to(`patient_${alert.patientId}`)
      .emit('alertConfirmed', alert);
  }
}
