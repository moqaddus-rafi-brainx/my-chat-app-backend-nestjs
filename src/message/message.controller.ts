import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { ConversationService } from '../conversation/conversation.service';
import { WebSocketBroadcastService } from '../chat/websocket-broadcast.service';

@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly broadcastService: WebSocketBroadcastService
  ) {}

  @Post()
  async create(
    @Body() createMessageDto: CreateMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.messageService.create(createMessageDto, user.id);
  }

  @Get('conversation/:conversationId')
  async findAllByConversation(@Param('conversationId') conversationId: string) {
    return this.messageService.findAllByConversation(conversationId);
  }

  @Post('search')
  async searchMessages(
    @Body() searchDto: SearchMessagesDto,
    @CurrentUser() user: any
  ) {
    console.log(`🔍 User ${user.id} searching for: "${searchDto.query}"`);
    return this.messageService.searchMessages(searchDto, user.id);
  }

  @Post('search/conversation/:conversationId')
  async searchMessagesInConversation(
    @Param('conversationId') conversationId: string,
    @Body() searchDto: SearchMessagesDto,
    @CurrentUser() user: any
  ) {
    console.log(`🔍 User ${user.id} searching in conversation ${conversationId} for: "${searchDto.query}"`);
    
    // Override the conversationId in the search DTO
    const conversationSearchDto = {
      ...searchDto,
      conversationId: conversationId
    };
    
    return this.messageService.searchMessages(conversationSearchDto, user.id);
  }

  @Put(':id')
  async editMessage(
    @Param('id') messageId: string,
    @Body() editMessageDto: EditMessageDto,
    @CurrentUser() user: any
  ) {
    const result = await this.messageService.editMessage(messageId, editMessageDto.content, user.id);
    
    // Broadcast WebSocket event if message edit was successful
    if (result.success && result.data) {
      const updatedMessage = result.data;
      
      console.log(`📢 Broadcasting message_edited to conversation ${updatedMessage.conversationId}`);
      
      const messageEditData = {
        success: true,
        message: 'Message has been edited',
        data: {
          messageId: updatedMessage._id,
          conversationId: updatedMessage.conversationId,
          content: updatedMessage.content,
          editedBy: user.id,
          editedAt: (updatedMessage as any).updatedAt
        }
      };
      
      console.log('📊 Message Edit Data:', JSON.stringify(messageEditData, null, 2));
      
      // Broadcast to all clients in the conversation room using Socket.IO rooms
      this.broadcastService.broadcastToRoom(updatedMessage.conversationId.toString(), 'message_edited', messageEditData);
    }
    
    return result;
  }

  @Delete(':id')
  async deleteMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: any
  ) {
    const result = await this.messageService.deleteMessage(messageId, user.id);
    
    // Broadcast WebSocket event if message deletion was successful
    if (result.success && result.data) {
      const deletedMessage = result.data;
      
      console.log(`📢 Broadcasting message_deleted to conversation ${deletedMessage.conversationId} (excluding deleter)`);
      
      const messageDeleteData = {
        success: true,
        message: 'Message has been deleted',
        data: {
          messageId: deletedMessage._id,
          conversationId: deletedMessage.conversationId,
          deletedBy: user.id,
          deletedAt: (deletedMessage as any).updatedAt
        }
      };
      
      console.log('📊 Message Delete Data:', JSON.stringify(messageDeleteData, null, 2));
      
      // Broadcast to all clients in the conversation room using Socket.IO rooms
      // The frontend can filter out the event for the deleter based on deletedBy field
      this.broadcastService.broadcastToRoom(deletedMessage.conversationId.toString(), 'message_deleted', messageDeleteData);
      
      console.log('✅ Message deletion broadcasted to room:', deletedMessage.conversationId);
    }
    
    return result;
  }

  @Put(':id/pin')
  async pinMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: any
  ) {
    const result = await this.messageService.pinMessage(messageId, user.id);
    if (result.success && result.data) {
      const pinned = result.data;
      const payload = {
        success: true,
        message: 'Message pinned',
        data: {
          messageId: pinned._id,
          conversationId: pinned.conversationId,
          pinnedBy: user.id,
          is_pinned: true,
          updatedAt: (pinned as any).updatedAt
        }
      };
      // Send to all members except the actor
      const conversation = await this.conversationService.findOne(pinned.conversationId.toString());
      if (conversation) {
        const memberIds = Array.from(new Set(conversation.members.map((m: any) => (m._id ? m._id.toString() : m.toString()))));
        this.broadcastService.sendToUsersExcept(memberIds, user.id, 'message_pinned', payload);
        console.log('📡 Message pinned event broadcasted to members (deduped):', memberIds);
      }
    }
    return result;
  }

  @Put(':id/unpin')
  async unpinMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: any
  ) {
    const result = await this.messageService.unpinMessage(messageId, user.id);
    if (result.success && result.data) {
      const unpinned = result.data;
      const payload = {
        success: true,
        message: 'Message unpinned',
        data: {
          messageId: unpinned._id,
          conversationId: unpinned.conversationId,
          unpinnedBy: user.id,
          is_pinned: false,
          updatedAt: (unpinned as any).updatedAt
        }
      };
      const conversation = await this.conversationService.findOne(unpinned.conversationId.toString());
      if (conversation) {
        const memberIds = Array.from(new Set(conversation.members.map((m: any) => (m._id ? m._id.toString() : m.toString()))));
        this.broadcastService.sendToUsersExcept(memberIds, user.id, 'message_unpinned', payload);
      }
    }
    return result;
  }
}
