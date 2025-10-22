import {
    CanActivate,
    ExecutionContext,
    Injectable,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { Socket } from 'socket.io';
  
  @Injectable()
  export class WsJwtGuard implements CanActivate {
    constructor(private jwtService: JwtService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
  
      console.log('🔐 WebSocket Auth - Token received:', token ? 'Yes' : 'No');
      console.log('🔐 WebSocket Auth - Auth object:', client.handshake.auth);
      console.log('🔐 WebSocket Auth - Headers:', client.handshake.headers?.authorization);
  
      if (!token) {
        console.log('❌ WebSocket Auth - No token found');
        return false;
      }
  
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });
        console.log('✅ WebSocket Auth - Token verified successfully');
        console.log('🔍 WebSocket Auth - Payload:', payload);
        client.data.user = payload;
        return true;
      } catch (err) {
        console.log('❌ WebSocket Auth - Token verification failed:', err.message);
        return false;
      }
    }
  }
  