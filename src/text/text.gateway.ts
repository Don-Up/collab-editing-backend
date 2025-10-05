// Updated backend code (NestJS WebSocketGateway)
// Supports multiple documents via Socket.IO rooms

import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as DiffMatchPatch from 'diff-match-patch';

/**
 * TextGateway implements OnGatewayConnection and OnGatewayDisconnect to handle client connection/disconnection events. It's decorated with @WebSocketGateway({ cors: true }) to enable Cross-Origin Resource Sharing (CORS), allowing clients from different domains to connect.
 *
 * 1. Clients join a document room via join:room and get the initial document state.
 * 2. When a client edits the document, they generate a patch (using diff-match-patch) and send it via text:patch.
 * 3. The server applies the patch, updates its stored document, and broadcasts the patch to other clients in the room.
 * 4. If a patch fails (conflict), the server syncs the full document to all clients in the room.
 * 5. Clients can manually request the latest document with text:request_sync.
 */
@WebSocketGateway({ cors: true })
export class TextGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server; // A reference to the Socket.IO server instance, used to broadcast messages.
  // Stores the current state of each document, mapped by `roomId` (unique identifier for a document).
  private documents: Map<string, string> = new Map();
  // An instance of the `diffmatchpatch` library, used to create and apply text patches.
  private dmp: any; // Use 'any' temporarily to bypass type issues

  constructor() {
    this.dmp = new (DiffMatchPatch as any).diff_match_patch(); // Explicit instantiation
  }

  // Logs when a client connects (with their Socket.IO client ID).
  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  // Logs when a client disconnects.
  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  /**
   * join:room
   * Purpose: Lets a client join a specific document room and receive the current document state.
   * @param roomId
   * @param client
   */
  @SubscribeMessage('join:room')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // When a client sends a join:room event with a roomId, the client is added to that Socket.IO room.
    client.join(roomId);
    const doc = this.documents.get(roomId) || '';
    // The gateway checks if the document for roomId exists in the documents map. If not, it initializes the document with an empty string.
    if (!this.documents.has(roomId)) {
      this.documents.set(roomId, '');
    }
    // The client receives a text:sync event with the current document content, so their local copy matches the server's.
    client.emit('text:sync', doc); // Send current text for the room to the client
  }

  @SubscribeMessage('text:patch')
  handleTextPatch(
    @MessageBody() data: { roomId: string; patchText: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, patchText } = data;
    // The server retrieves the current document state for roomId.
    const doc = this.documents.get(roomId) || '';
    //  It converts patchText into a patch object using dmp.patch_fromText().
    const patches = this.dmp.patch_fromText(patchText);
    // The patch is applied to the current document with dmp.patch_apply(), producing a newDoc (updated document) and results (array indicating if each part of the patch succeeded).
    const [newDoc, results] = this.dmp.patch_apply(patches, doc);

    const success = results.every((res: boolean) => res);

    if (success) {
      // If all parts of the patch succeeded (results.every(...)), the server updates its stored document and broadcasts the patch to all other clients in the room (via client.to(roomId).emit), so they can apply the same edit.
      this.documents.set(roomId, newDoc);
      console.log(patchText, newDoc);
      client.to(roomId).emit('text:patch', patchText); // Broadcast the patch to others in the room
    } else {
      // Fall back to full sync if patch fails (sync the current document, rejecting the patch)
      this.server.to(roomId).emit('text:sync', doc);
    }
  }

  // Lets a client request the latest version of a document (e.g., if they missed updates).
  @SubscribeMessage('text:request_sync')
  handleRequestSync(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // When a client sends text:request_sync with roomId, the server responds with a text:sync event containing the current document content for that room.
    const doc = this.documents.get(roomId) || '';
    client.emit('text:sync', doc); // Send full text for the room to requesting client
  }
}
