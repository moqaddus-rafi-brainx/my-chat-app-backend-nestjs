import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
import { MessageService } from '../message/message.service';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { WebSocketConnectionManager } from './websocket-connection.manager';
import { ConversationService } from '../conversation/conversation.service';
import { WebSocketBroadcastService } from './websocket-broadcast.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
  
  @WebSocketGateway({
    cors: {
      origin: [
        process.env.WS_CORS_ORIGIN,
        process.env.CORS_ORIGIN,
        'https://my-chat-app-frontend-two.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174'
      ].filter(Boolean),
      credentials: true,
    },
  })
  export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer()
    server: Server;
  
    constructor(
      private readonly messageService: MessageService,
      private readonly authService: AuthService,
      private readonly jwtService: JwtService,
      private readonly connectionManager: WebSocketConnectionManager,
      private readonly conversationService: ConversationService,
      private readonly broadcastService: WebSocketBroadcastService,
      @InjectModel(User.name) private readonly userModel: Model<User>,
    ) {}

    afterInit(server: Server) {
      console.log('🚀 WebSocket Gateway initialized');
      console.log('🌐 WebSocket CORS origins:', [
        process.env.WS_CORS_ORIGIN,
        process.env.CORS_ORIGIN,
        'https://my-chat-app-frontend-two.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
      ].filter(Boolean));
      
      // Check if we're in Vercel serverless environment
      if (process.env.VERCEL) {
        console.log('⚠️ Running in Vercel serverless - WebSocket may have limitations');
      }
      
      this.broadcastService.setServer(server);
    }
  
    async handleConnection(client: Socket) {
      console.log(`✅ Client connected: ${client.id}`);
      console.log('🌐 WebSocket Origin:', client.handshake.headers.origin);
      console.log('🌐 WebSocket Headers:', client.handshake.headers);
      
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

        // Join a personal room to allow targeted emits by userId
        try {
          // Ensure only one active socket remains in the personal room
          const existingSockets = await this.server.in(payload.sub).fetchSockets();
          for (const s of existingSockets) {
            if (s.id !== client.id) {
              try { s.leave(payload.sub); } catch {}
            }
          }
          client.join(payload.sub);
          console.log(`🏷️ Client ${client.id} joined personal room: ${payload.sub}`);
        } catch (e) {
          console.log('⚠️ Failed to join personal room:', e?.message);
        }
        
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

    @SubscribeMessage('typing')
    async handleTyping(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string },
    ) {
      try {
        const userId = client.data.user?.sub;
        
        if (!userId) {
          console.log('❌ No userId found for typing event');
          return;
        }

        // Debug: Check what's in the JWT payload
        console.log('🔍 JWT Payload for typing event:', JSON.stringify(client.data.user, null, 2));
        
        // Fetch user details from database
        const user = await this.userModel.findById(userId).select('name email').exec();
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || '';

        console.log(`⌨️ User ${userName} (${userId}) is typing in conversation ${data.conversationId}`);
        
        const typingEventData = {
          success: true,
          message: 'User is typing',
          data: {
            conversationId: data.conversationId,
            userId: userId,
            userName: userName,
            userEmail: userEmail,
            timestamp: new Date()
          }
        };
        
        console.log('📊 Typing Event Data Being Sent:', JSON.stringify(typingEventData, null, 2));
        
        // Broadcast typing event to all other members in the conversation room
        // Exclude the sender by using the room broadcast
        client.to(data.conversationId).emit('user_typing', typingEventData);
        
        console.log(`📡 Typing event broadcasted to conversation ${data.conversationId} (excluding sender)`);
        
      } catch (error) {
        console.error('❌ Error handling typing event:', error);
      }
    }

    @SubscribeMessage('stop_typing')
    async handleStopTyping(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { conversationId: string },
    ) {
      try {
        const userId = client.data.user?.sub;
        
        if (!userId) {
          console.log('❌ No userId found for stop typing event');
          return;
        }

        // Debug: Check what's in the JWT payload
        console.log('🔍 JWT Payload for stop typing event:', JSON.stringify(client.data.user, null, 2));
        
        // Fetch user details from database
        const user = await this.userModel.findById(userId).select('name email').exec();
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || '';

        console.log(`⌨️ User ${userName} (${userId}) stopped typing in conversation ${data.conversationId}`);
        
        const stopTypingEventData = {
          success: true,
          message: 'User stopped typing',
          data: {
            conversationId: data.conversationId,
            userId: userId,
            userName: userName,
            userEmail: userEmail,
            timestamp: new Date()
          }
        };
        
        console.log('📊 Stop Typing Event Data Being Sent:', JSON.stringify(stopTypingEventData, null, 2));
        
        // Broadcast stop typing event to all other members in the conversation room
        // Exclude the sender by using the room broadcast
        client.to(data.conversationId).emit('user_stopped_typing', stopTypingEventData);
        
        console.log(`📡 Stop typing event broadcasted to conversation ${data.conversationId} (excluding sender)`);
        
      } catch (error) {
        console.error('❌ Error handling stop typing event:', error);
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
  