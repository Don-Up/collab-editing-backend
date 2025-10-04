import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as DiffMatchPatch from 'diff-match-patch';

@WebSocketGateway({ cors: true })
export class TextGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private document: string = '';  // In-memory shared text
  private dmp: any;  // Use 'any' temporarily to bypass type issues

  constructor() {
    this.dmp = new (DiffMatchPatch as any).diff_match_patch();  // Explicit instantiation
  }

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
    client.emit('text:sync', this.document);  // Send current text to new client
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('text:patch')
  handleTextPatch(@MessageBody() patchText: string, @ConnectedSocket() client: Socket) {
    const patches = this.dmp.patch_fromText(patchText);
    const [newDoc, results] = this.dmp.patch_apply(patches, this.document);

    const success = results.every((res: boolean) => res);

    if (success) {
      this.document = newDoc;
      client.broadcast.emit('text:patch', patchText);  // Broadcast the patch to others
    } else {
      // Fall back to full sync if patch fails
      this.server.emit('text:sync', this.document);
    }
  }

  @SubscribeMessage('text:request_sync')
  handleRequestSync(@ConnectedSocket() client: Socket) {
    client.emit('text:sync', this.document);  // Send full text to requesting client
  }
}