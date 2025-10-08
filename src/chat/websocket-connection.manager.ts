import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WebSocketConnectionManager {
  private userConnections: Map<string, Socket> = new Map(); // userId -> Socket
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId

  // Add a user connection
  addConnection(userId: string, socket: Socket): void {
    // Remove any existing connection for this user
    const existingSocket = this.userConnections.get(userId);
    if (existingSocket) {
      this.socketToUser.delete(existingSocket.id);
    }

    // Add new connection
    this.userConnections.set(userId, socket);
    this.socketToUser.set(socket.id, userId);
    
    console.log(`🔗 User ${userId} connected with socket ${socket.id}`);
    console.log(`📊 Total active connections: ${this.userConnections.size}`);
  }

  // Remove a user connection
  removeConnection(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (userId) {
      this.userConnections.delete(userId);
      this.socketToUser.delete(socketId);
      console.log(`🔌 User ${userId} disconnected (socket ${socketId})`);
      console.log(`📊 Total active connections: ${this.userConnections.size}`);
    }
  }

  // Get socket for a specific user
  getSocketForUser(userId: string): Socket | undefined {
    return this.userConnections.get(userId);
  }

  // Get all active user IDs
  getActiveUserIds(): string[] {
    return Array.from(this.userConnections.keys());
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userConnections.has(userId);
  }

  // Get user ID from socket
  getUserIdFromSocket(socketId: string): string | undefined {
    return this.socketToUser.get(socketId);
  }

  // Send event to specific user
  sendToUser(userId: string, event: string, data: any): boolean {
    const socket = this.getSocketForUser(userId);
    if (socket && socket.connected) {
      socket.emit(event, data);
      console.log(`📤 Sent ${event} to user ${userId}`);
      return true;
    }
    console.log(`❌ User ${userId} not connected or socket not available`);
    return false;
  }

  // Send event to multiple users
  sendToUsers(userIds: string[], event: string, data: any): number {
    let sentCount = 0;
    userIds.forEach(userId => {
      if (this.sendToUser(userId, event, data)) {
        sentCount++;
      }
    });
    console.log(`📤 Sent ${event} to ${sentCount}/${userIds.length} users`);
    return sentCount;
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.userConnections.size,
      activeUsers: this.getActiveUserIds()
    };
  }
}
