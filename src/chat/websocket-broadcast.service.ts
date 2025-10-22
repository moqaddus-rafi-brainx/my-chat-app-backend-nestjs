import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketBroadcastService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  // Broadcast to a specific room
  broadcastToRoom(roomId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(roomId).emit(event, data);
      console.log(`📡 Broadcasted ${event} to room: ${roomId}`);
    } else {
      console.log(`❌ WebSocket server not available for broadcasting ${event} to room: ${roomId}`);
    }
  }

  // Broadcast to multiple rooms
  broadcastToRooms(roomIds: string[], event: string, data: any): void {
    if (this.server) {
      roomIds.forEach(roomId => {
        this.server.to(roomId).emit(event, data);
      });
      console.log(`📡 Broadcasted ${event} to ${roomIds.length} rooms`);
    } else {
      console.log(`❌ WebSocket server not available for broadcasting ${event} to rooms`);
    }
  }

  // Send to specific users (using user IDs as room names)
  sendToUsers(userIds: string[], event: string, data: any): void {
    if (this.server) {
      const uniqueIds = Array.from(new Set(userIds));
      uniqueIds.forEach(userId => {
        this.server.to(userId).emit(event, data);
      });
      console.log(`📡 Sent ${event} to ${uniqueIds.length}/${userIds.length} users (deduped)`);
    } else {
      console.log(`❌ WebSocket server not available for sending ${event} to users`);
    }
  }

  // Send to users except a specific userId
  sendToUsersExcept(userIds: string[], excludeUserId: string, event: string, data: any): void {
    const uniqueTargets = Array.from(new Set(userIds)).filter(id => id !== excludeUserId);
    this.sendToUsers(uniqueTargets, event, data);
  }
}
