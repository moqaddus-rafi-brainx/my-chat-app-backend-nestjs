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
    
    // Debug logging
    console.log(`🔍 Attempting to send ${event} to user ${userId}`);
    console.log(`🔍 Socket found: ${socket ? 'Yes' : 'No'}`);
    if (socket) {
      console.log(`🔍 Socket ID: ${socket.id}`);
      console.log(`🔍 Socket connected: ${socket.connected}`);
      console.log(`🔍 Socket disconnected: ${socket.disconnected}`);
    }
    
    if (socket && socket.connected && !socket.disconnected) {
      try {
        socket.emit(event, data);
        console.log(`📤 Sent ${event} to user ${userId}`);
        return true;
      } catch (error) {
        console.log(`❌ Error sending ${event} to user ${userId}:`, error.message);
        // Remove the broken connection
        this.removeConnection(socket.id);
        return false;
      }
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

  // Clean up stale connections
  cleanupStaleConnections(): void {
    const staleConnections: string[] = [];
    
    this.userConnections.forEach((socket, userId) => {
      if (!socket.connected || socket.disconnected) {
        staleConnections.push(socket.id);
        console.log(`🧹 Cleaning up stale connection for user ${userId} (socket ${socket.id})`);
      }
    });
    
    staleConnections.forEach(socketId => {
      this.removeConnection(socketId);
    });
    
    if (staleConnections.length > 0) {
      console.log(`🧹 Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.userConnections.size,
      activeUsers: this.getActiveUserIds()
    };
  }
}
