import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
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
    const result = await this.conversationService.remove(id, user.id);
    
    // Broadcast WebSocket event if deletion was successful
    if (result.success && result.data?.deletedConversation) {
      const { deletedConversation } = result.data;
      
      // Get all member IDs for the deleted conversation
      const memberIds = deletedConversation.members.map((member: any) => member.toString());
      
      console.log(`📢 Broadcasting conversation_deleted to ${memberIds.length} members:`, memberIds);
      
      // Send conversation_deleted event to all members
      this.connectionManager.sendToUsers(memberIds, 'conversation_deleted', {
        success: true,
        message: 'Conversation deleted by admin',
        data: {
          conversationId: deletedConversation.id,
          conversationName: deletedConversation.name,
          conversationType: deletedConversation.type,
          deletedBy: user.id
        }
      });
    }
    
    return result;
  }

  @Delete(':id/member')
  async removeMember(
    @Param('id') conversationId: string,
    @Body() removeMemberDto: RemoveMemberDto,
    @CurrentUser() user: any
  ) {
    console.log('📡 Removing member from conversation:', conversationId, removeMemberDto.memberIds, user.id);
    const result = await this.conversationService.removeMember(
      conversationId,
      removeMemberDto.memberIds,
      user.id
    );
    console.log("result:",result);
    
    // Broadcast WebSocket event if member removal was successful
    if (result.success && result.data?.removedMemberIds) {
      const { removedMemberIds } = result.data;
      
      console.log(`📢 Broadcasting member_removed to conversation ${conversationId} for ${removedMemberIds.length} members`);
      
      // Send member_removed event to each removed member
      removedMemberIds.forEach((removedMemberId: string) => {
        this.connectionManager.sendToUser(removedMemberId, 'member_removed', {
          success: true,
          message: 'You have been removed from the conversation',
          data: {
            conversationId: conversationId,
            removedBy: user.id
          }
        });
      });

      // Note: No event to remaining members per new requirement
    }
    
    return result;
  }

  @Delete(':id/leave')
  async leaveGroup(
    @Param('id') conversationId: string,
    @CurrentUser() user: any
  ) {
    const result = await this.conversationService.leaveGroup(conversationId, user.id);
    
    // Broadcast WebSocket event if user successfully left
    if (result.success && result.data?.leftMembers) {
      const { leftMembers, newAdminId, wasAdmin } = result.data;
      
      console.log(`📢 Broadcasting user_left_group to conversation ${conversationId}`);
      
      // Send user_left_group event to all remaining members
      const remainingMembers = result.data.conversation.members
        .map((member: any) => member._id.toString());
      
      const userLeftGroupData = {
        success: true,
        message: 'A user has left the conversation',
        data: {
          conversationId: conversationId,
          leftMembers: leftMembers,
          leftBy: user.id,
          wasAdmin: wasAdmin,
          newAdminId: newAdminId
        }
      };
      
      console.log('📊 User Left Group Data:', JSON.stringify(userLeftGroupData, null, 2));
      
      this.connectionManager.sendToUsers(remainingMembers, 'user_left_group', userLeftGroupData);

      // Send confirmation to the user who left
      this.connectionManager.sendToUser(user.id, 'left_group_success', {
        success: true,
        message: 'You have successfully left the conversation',
        data: {
          conversationId: conversationId,
          wasAdmin: wasAdmin,
          newAdminId: newAdminId
        }
      });
    }
    
    return result;
  }
}
