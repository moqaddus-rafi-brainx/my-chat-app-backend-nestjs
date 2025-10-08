import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CurrentUser } from 'src/auth/decorators/user.decorator';
import { ChatGateway } from '../chat/chat.gateway';
import { WebSocketConnectionManager } from '../chat/websocket-connection.manager';
import { ConversationType } from '../constants';

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly chatGateway: ChatGateway,
    private readonly connectionManager: WebSocketConnectionManager,
  ) {}

  @Post()
  async create(@Body() createConversationDto: CreateConversationDto, @CurrentUser() user: any ) {
    const result = await this.conversationService.create(createConversationDto, user.id);
    
    // Broadcast WebSocket event for group conversations
    if (result.success && createConversationDto.type === ConversationType.GROUP) {
      console.log('📢 Broadcasting new group conversation to other members');
      
      // Get all member IDs except the creator
      const memberIds = result.data.members
        .map((member: any) => member._id.toString())
        .filter((memberId: string) => memberId !== user.id);
      
      console.log(`📤 Sending to ${memberIds.length} other members:`, memberIds);
      
      // Send to other members only
      this.connectionManager.sendToUsers(memberIds, 'new_conversation', {
        success: true,
        message: 'You were added to a new group',
        data: result.data
      });
    }
    
    return result;
  }

  @Get()
  async findAll(@CurrentUser() user: any, @Query('type') type?: string) {
    const result = await this.conversationService.findAll(user.id, type);
    return {
      success: true,
      message: 'Conversations retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConversationDto: UpdateConversationDto) {
    return this.conversationService.update(+id, updateConversationDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.conversationService.remove(id, user.id);
  }
}
