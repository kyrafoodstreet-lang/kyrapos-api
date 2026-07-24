import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const getOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  return frontendUrl
    ? frontendUrl.split(',').map((url) => url.trim())
    : ['http://localhost:3000', 'http://localhost:3002'];
};

@WebSocketGateway({
  cors: {
    origin: getOrigins(),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitOrderCreated(order: any) {
    this.server.emit('orderCreated', order);
  }

  emitOrderStatusUpdated(orderId: string, status: string, order: any) {
    this.server.emit('orderStatusUpdated', { orderId, status, order });
  }

  emitOrderPaid(orderId: string, order: any) {
    this.server.emit('orderPaid', { orderId, order });
  }
}
