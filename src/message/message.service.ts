import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { Message, MessageDocument } from '../schemas/message.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { ConversationService } from '../conversation/conversation.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private conversationService: ConversationService,
  ) {}

  async create(createMessageDto: CreateMessageDto, senderId: string) {
    const { content, conversationId } = createMessageDto;

    // Verify sender exists
    const sender = await this.userModel.findById(senderId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    // Check if this is the first message in the conversation
    const existingMessagesCount = await this.messageModel.countDocuments({ conversationId });
    const isFirstMessage = existingMessagesCount === 0;

    const message = new this.messageModel({
      content,
      senderId,
      conversationId,
    });

    const savedMessage = await message.save();
    
    // Update conversation's last activity
    await this.conversationService.updateLastActivity(conversationId);
    
    // Populate sender info for response
    const populatedMessage = await this.messageModel
      .findById(savedMessage._id)
      .populate('senderId', 'name email')
      .exec();

    return {
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage,
      isFirstMessage, // Add this flag to the response
    };
  }

  async findAllByConversation(conversationId: string) {
    const messages = await this.messageModel
      .find({ conversationId })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 })
      .exec();

    return {
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    };
  }

  async deleteAllByConversation(conversationId: string) {
    try {
      const result = await this.messageModel.updateMany(
        { 
          conversationId,
          is_deleted: { $ne: true } // Only update messages that aren't already deleted
        },
        { 
          is_deleted: true,
          updatedAt: new Date()
        }
      );
      console.log(`🗑️ Marked ${result.modifiedCount} messages as deleted for conversation: ${conversationId}`);
      return {
        success: true,
        message: `Marked ${result.modifiedCount} messages as deleted successfully`,
        data: { modifiedCount: result.modifiedCount }
      };
    } catch (error) {
      console.error('❌ Error deleting messages:', error);
      return {
        success: false,
        message: 'Failed to delete messages',
        data: null
      };
    }
  }

  // Edit a message
  async editMessage(messageId: string, newContent: string, userId: string) {
    try {
      // Validate message ID format
      if (!messageId || typeof messageId !== 'string') {
        return {
          success: false,
          message: 'Invalid message ID',
          data: null
        };
      }

      // Check if message ID is a temporary ID (starts with 'temp_')
      if (messageId.startsWith('temp_')) {
        return {
          success: false,
          message: 'Cannot edit temporary message. Please wait for the message to be saved.',
          data: null
        };
      }

      // Validate ObjectId format (24 character hex string)
      if (!/^[0-9a-fA-F]{24}$/.test(messageId)) {
        return {
          success: false,
          message: 'Invalid message ID format',
          data: null
        };
      }

      // Find the message
      const message = await this.messageModel.findById(messageId);
      
      if (!message) {
        return {
          success: false,
          message: 'Message not found',
          data: null
        };
      }

      // Check if message is deleted
      if (message.is_deleted) {
        return {
          success: false,
          message: 'Cannot edit a deleted message',
          data: null
        };
      }

      // Check if user is the sender
      if (message.senderId.toString() !== userId.toString()) {
        return {
          success: false,
          message: 'You can only edit your own messages',
          data: null
        };
      }

      // Update the message content
      const updatedMessage = await this.messageModel.findByIdAndUpdate(
        messageId,
        { 
          content: newContent,
          is_edited: true,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('senderId', 'name email').exec();

      if (!updatedMessage) {
        return {
          success: false,
          message: 'Failed to edit message',
          data: null
        };
      }

      console.log(`✏️ Message ${messageId} edited by user ${userId}`);

      return {
        success: true,
        message: 'Message edited successfully',
        data: updatedMessage
      };
    } catch (error) {
      console.error('❌ Error editing message:', error);
      return {
        success: false,
        message: 'Failed to edit message',
        data: null
      };
    }
  }

  // Delete a message
  async deleteMessage(messageId: string, userId: string) {
    try {
      // Find the message
      const message = await this.messageModel.findById(messageId);
      
      if (!message) {
        return {
          success: false,
          message: 'Message not found',
          data: null
        };
      }

      // Check if message is already deleted
      if (message.is_deleted) {
        return {
          success: false,
          message: 'Message is already deleted',
          data: null
        };
      }

      // Check if user is the sender
      if (message.senderId.toString() !== userId.toString()) {
        return {
          success: false,
          message: 'You can only delete your own messages',
          data: null
        };
      }

      // Mark message as deleted instead of actually deleting it
      const deletedMessage = await this.messageModel.findByIdAndUpdate(
        messageId,
        { 
          is_deleted: true,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('senderId', 'name email').exec();

      if (!deletedMessage) {
        return {
          success: false,
          message: 'Failed to delete message',
          data: null
        };
      }

      console.log(`🗑️ Message ${messageId} marked as deleted by user ${userId}`);

      return {
        success: true,
        message: 'Message deleted successfully',
        data: deletedMessage
      };
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      return {
        success: false,
        message: 'Failed to delete message',
        data: null
      };
    }
  }

  async pinMessage(messageId: string, userId: string) {
    try {
      const message = await this.messageModel.findById(messageId);
      if (!message) {
        return { success: false, message: 'Message not found', data: null };
      }

      // Optional: only members of conversation can pin
      const conversation = await this.conversationService.findOne(message.conversationId.toString());
      const isMember = conversation?.members?.some((m: any) => m._id?.toString() === userId.toString() || m.toString?.() === userId.toString());
      if (!isMember) {
        return { success: false, message: 'Only conversation members can pin messages', data: null };
      }

      if (message.is_pinned) {
        return { success: true, message: 'Message already pinned', data: message };
      }

      const updated = await this.messageModel.findByIdAndUpdate(
        messageId,
        { is_pinned: true, updatedAt: new Date() },
        { new: true }
      ).populate('senderId', 'name email').exec();

      return { success: true, message: 'Message pinned', data: updated };
    } catch (error) {
      console.error('❌ Error pinning message:', error);
      return { success: false, message: 'Failed to pin message', data: null };
    }
  }

  async unpinMessage(messageId: string, userId: string) {
    try {
      const message = await this.messageModel.findById(messageId);
      if (!message) {
        return { success: false, message: 'Message not found', data: null };
      }

      const conversation = await this.conversationService.findOne(message.conversationId.toString());
      const isMember = conversation?.members?.some((m: any) => m._id?.toString() === userId.toString() || m.toString?.() === userId.toString());
      if (!isMember) {
        return { success: false, message: 'Only conversation members can unpin messages', data: null };
      }

      if (!message.is_pinned) {
        return { success: true, message: 'Message already unpinned', data: message };
      }

      const updated = await this.messageModel.findByIdAndUpdate(
        messageId,
        { is_pinned: false, updatedAt: new Date() },
        { new: true }
      ).populate('senderId', 'name email').exec();

      return { success: true, message: 'Message unpinned', data: updated };
    } catch (error) {
      console.error('❌ Error unpinning message:', error);
      return { success: false, message: 'Failed to unpin message', data: null };
    }
  }

  // Search messages across all user conversations
  async searchMessages(searchDto: SearchMessagesDto, userId: string) {
    try {
      const { query, conversationId } = searchDto;

      // Get all conversations where the user is a member
      const userConversations = await this.conversationModel.find({
        members: userId
      }).select('_id').exec();

      const conversationIds = userConversations.map(conv => (conv._id as any).toString());

      // Build search query
      let searchQuery: any = {
        conversationId: { $in: conversationIds },
        is_deleted: { $ne: true }, // Exclude deleted messages
        content: { $regex: query, $options: 'i' } // Case-insensitive search
      };

      // If searching within a specific conversation
      if (conversationId) {
        searchQuery.conversationId = conversationId;
      }

      // Search messages with pagination
      const messages = await this.messageModel
        .find(searchQuery)
        .populate('senderId', 'name email')
        .populate('conversationId', 'name type members')
        .sort({ createdAt: -1 }) // Most recent first
        .limit(50) // Limit results
        .exec();

      // Process results to include conversation display name
      const processedMessages = await Promise.all(
        messages.map(async (message) => {
          const conversation = message.conversationId as any;
          let conversationDisplayName = '';

          if (conversation.type === 'group') {
            // For group conversations, use the group name
            conversationDisplayName = conversation.name || 'Group Chat';
          } else {
            // For direct conversations, find the other person's name
            const otherMember = conversation.members.find(
              (member: any) => member._id.toString() !== userId
            );
            
            if (otherMember) {
              const otherUser = await this.userModel.findById(otherMember._id).select('name').exec();
              conversationDisplayName = otherUser?.name || 'Unknown User';
            } else {
              conversationDisplayName = 'Direct Chat';
            }
          }

          return {
            _id: message._id,
            content: message.content,
            senderId: message.senderId,
            conversationId: message.conversationId,
            is_edited: message.is_edited,
            is_pinned: message.is_pinned,
            createdAt: message.createdAt,
            updatedAt: (message as any).updatedAt,
            conversationDisplayName,
            conversationType: conversation.type,
            conversationName: conversation.name
          };
        })
      );

      console.log(`🔍 Found ${processedMessages.length} messages for query: "${query}"`);

      return {
        success: true,
        message: `Found ${processedMessages.length} messages`,
        data: {
          messages: processedMessages,
          totalCount: processedMessages.length,
          query: query
        }
      };

    } catch (error) {
      console.error('❌ Error searching messages:', error);
      return {
        success: false,
        message: 'Failed to search messages',
        data: null
      };
    }
  }
}
