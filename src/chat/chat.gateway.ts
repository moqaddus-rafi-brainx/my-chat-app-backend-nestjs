import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
import { MessageService } from '../message/message.service';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { WebSocketConnectionManager } from './websocket-connection.manager';
import { ConversationService } from '../conversation/conversation.service';
  
  @WebSocketGateway({
    cors: {
      origin: '*',
    },
  })
  export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    constructor(
      private readonly messageService: MessageService,
      private readonly authService: AuthService,
      private readonly jwtService: JwtService,
      private readonly connectionManager: WebSocketConnectionManager,
      private readonly conversationService: ConversationService,
    ) {}
  
    async handleConnection(client: Socket) {
      console.log(`✅ Client connected: ${client.id}`);
      
      try {
        // Get token from auth object or headers
        const token = client.handshake.auth?.token || 
                     client.handshake.headers?.authorization?.split(' ')[1];
        
        console.log('🔐 WebSocket Auth - Token received:', token ? 'Yes' : 'No');
        console.log('🔐 WebSocket Auth - Auth object:', client.handshake.auth);
        console.log('🔐 WebSocket Auth - Headers:', client.handshake.headers?.authorization);
        
        if (!token) {
          console.log('❌ WebSocket Auth - No token found');
          client.emit('unauthorized', { 
            success: false, 
            message: 'Authentication required' 
          });
          client.disconnect();
          return;
        }
        
        // Verify JWT token
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });
        
        console.log('✅ WebSocket Auth - Token verified successfully');
        console.log('🔍 WebSocket Auth - Payload:', payload);
        
        // Store user data in client
        client.data.user = payload;
        
        // Add to connection manager
        this.connectionManager.addConnection(payload.sub, client);
        
        console.log(`👤 Authenticated user ID: ${payload.sub}`);
        client.emit('authenticated', { 
          success: true, 
          message: 'Successfully authenticated',
          user: payload 
        });
        
      } catch (error) {
        console.log('❌ WebSocket Auth - Token verification failed:', error.message);
        client.emit('unauthorized', { 
          success: false, 
          message: 'Invalid token' 
        });
        client.disconnect();
      }
    }
  
    async handleDisconnect(client: Socket) {
      console.log(`❌ Client disconnected: ${client.id}`);
      
      // Remove from connection manager
      this.connectionManager.removeConnection(client.id);
    }
  
    @SubscribeMessage('send_message')
    async handleSendMessage(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string; content: string },
    ) {
      try {
        console.log('📨 Message received:', data);
        
        // Get senderId from authenticated user (set by WsJwtGuard)
        const senderId = client.data.user?.sub;
        
        if (!senderId) {
          console.log('❌ No senderId found in token payload:', client.data.user);
          client.emit('message_error', {
            success: false,
            message: 'User not authenticated',
          });
          return;
        }
        
        console.log('👤 Sender ID from token:', senderId);
        console.log('👤 Full user payload:', client.data.user);
        
        // Create message using the message service
        const messageData = {
          content: data.content,
          conversationId: data.conversationId,
        };
        
        const result = await this.messageService.create(messageData, senderId);
        console.log('🔍 Result of creating message:', result.data);
        if (result.success) {
          // Check if this is the first message in a direct conversation
          if (result.isFirstMessage) {
            console.log('🎉 First message in conversation detected');
            
            // Get conversation details to find the other user
            const conversation = await this.getConversationDetails(data.conversationId);
            if (conversation && conversation.type === 'direct') {
              // Find the other user (not the sender)
              const otherUser = conversation.members.find(
                (member: any) => member._id.toString() !== senderId
              );
              
              if (otherUser) {
                console.log(`📤 Sending first_message event to user: ${otherUser._id}`);
                
                // Send first_message event to the other user only
                this.connectionManager.sendToUser(otherUser._id.toString(), 'first_message', {
                  success: true,
                  message: 'First message in direct conversation',
                  data: {
                    conversation: {
                      _id: conversation._id,
                      type: conversation.type,
                      members: conversation.members,
                      createdAt: (conversation as any).createdAt,
                      updatedAt: (conversation as any).updatedAt
                    },
                    message: result.data
                  }
                });
              }
            }
          }
          
          // Always broadcast the new message to all clients in the conversation room
          this.server.to(data.conversationId).emit('new_message', {
            success: true,
            message: 'Message sent successfully',
            data: result.data,
          });
          
          console.log('✅ Message broadcasted to room:', data.conversationId);
        } else {
          // Send error back to sender only
          client.emit('message_error', {
            success: false,
            message: result.message || 'Failed to send message',
          });
        }
      } catch (error) {
        console.error('❌ Error handling message:', error);
        client.emit('message_error', {
          success: false,
          message: 'Internal server error',
        });
      }
    }
  
    @SubscribeMessage('join_conversation')
    async handleJoinConversation(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string },
    ) {
      client.join(data.conversationId);
      console.log(`🏠 Client ${client.id} joined room: ${data.conversationId}`);
      
      // Send confirmation back to client
      client.emit('joined_conversation', { 
        conversationId: data.conversationId,
        message: 'Successfully joined conversation' 
      });
    }

    @SubscribeMessage('leave_conversation')
    async handleLeaveConversation(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string },
    ) {
      client.leave(data.conversationId);
      console.log(`🚪 Client ${client.id} left room: ${data.conversationId}`);
    }

    @SubscribeMessage('get_messages')
    async handleGetMessages(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string },
    ) {
      try {
        console.log('📥 Getting messages for conversation:', data.conversationId);
        
        // Get messages using the message service
        const result = await this.messageService.findAllByConversation(data.conversationId);
        console.log('🔍 Result:', result.data);
        if (result.success) {
          // Send messages back to the requesting client
          client.emit('messages_loaded', {
            success: true,
            message: 'Messages loaded successfully',
            data: result.data,
          });
          
          console.log('✅ Messages sent to client:', client.id);
        } else {
          client.emit('messages_error', {
            success: false,
            message: result.message || 'Failed to load messages',
          });
        }
      } catch (error) {
        console.error('❌ Error getting messages:', error);
        client.emit('messages_error', {
          success: false,
          message: 'Internal server error',
        });
      }
    }

    // Helper method to get conversation details
    private async getConversationDetails(conversationId: string) {
      try {
        // We need to get the conversation details
        // Since we can't directly access the conversation model here,
        // we'll use a simple approach by getting it from the conversation service
        const result = await this.conversationService.findOne(conversationId);
        return result;
      } catch (error) {
        console.error('❌ Error getting conversation details:', error);
        return null;
      }
    }
  }
  