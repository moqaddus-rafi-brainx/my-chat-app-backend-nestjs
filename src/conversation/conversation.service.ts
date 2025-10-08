import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Message, MessageDocument } from '../schemas/message.schema';
import { ConversationType } from '../constants';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    ) {}

    async create(createConversationDto: CreateConversationDto, userId: string) {
        const { name, members, type } = createConversationDto;
        
        // If it's a direct conversation, check if one already exists
        if (type === ConversationType.DIRECT) {
            const otherUserId = members[0]; // For direct conversation, there should be only one member
            
            // Check if direct conversation already exists between these two users
            const existingConversation = await this.conversationModel.findOne({
                type: ConversationType.DIRECT,
                members: { $all: [userId, otherUserId] }
            }).populate('members', 'name email').exec();
            
            if (existingConversation) {
                // Return existing conversation with otherUser info
                const otherUser: any = existingConversation.members.find(
                    (member: any) => member._id.toString() !== userId
                );
                
                return {
                    success: true,
                    message: 'Existing direct conversation found',
                    data: {
                        ...existingConversation.toObject(),
                        otherUser: otherUser ? {
                            id: otherUser._id,
                            name: otherUser.name,
                            email: otherUser.email
                        } : null
                    }
                };
            }
        }
        
        // Create new conversation
        const participants = [userId, ...members];
        const conversationData: any = { name, type, members: participants };
        
        // Set adminId for group conversations
        if (type === ConversationType.GROUP) {
            conversationData.adminId = userId;
        }
        
        const conversation = new this.conversationModel(conversationData);
        const savedConversation = await conversation.save();
        
        // Populate members for response
        const populatedConversation = await this.conversationModel
            .findById(savedConversation._id)
            .populate('members', 'name email')
            .exec();
        
        if (!populatedConversation) {
            throw new Error('Failed to create conversation');
        }
        
        // For direct conversations, add otherUser info
        let responseData: any = populatedConversation.toObject();
        if (type === ConversationType.DIRECT) {
            const otherUser: any = populatedConversation.members.find(
                (member: any) => member._id.toString() !== userId
            );
            
            responseData = {
                ...responseData,
                otherUser: otherUser ? {
                    id: otherUser._id,
                    name: otherUser.name,
                    email: otherUser.email
                    
                } : null
            };
        }

        // Note: WebSocket broadcasting will be handled in the controller
        
        return {
            success: true,
            message: 'Conversation created successfully',
            data: responseData,
        };
    }

  //Get all conversations for a user with optional type filter.
  async findAll(userId: string, type?: string) {    
    // Build aggregation pipeline
    const pipeline: any[] = [
      // Match conversations where user is a member
      { $match: { members: { $in: [new Types.ObjectId(userId)] } } }
    ];

    // Add type filter if provided
    if (type) {
      pipeline.push({ $match: { type: type } });
    }

    // Lookup members to populate user data
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'members',
        foreignField: '_id',
        as: 'members'
      }
    });

    // Project only needed fields from members
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        type: 1,
        members: {
          _id: 1,
          name: 1,
          email: 1
        },
        adminId: { $ifNull: ["$adminId", null] },
        createdAt: 1,
        updatedAt: 1
      }
    });

    const conversations = await this.conversationModel.aggregate(pipeline).exec();

    // For direct conversations, return the other user's info
    return conversations.map((conversation: any) => {
      if (conversation.type === ConversationType.DIRECT) {
        // Find the other user (not the current user)
        const otherUser: any = conversation.members.find(
          (member: any) => member._id.toString() !== userId.toString()
        );
        
        
        return {
          ...conversation,
          otherUser: otherUser ? {
            id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email
          } : null
        };
      }
      return conversation;
    });
  }

  async findOne(id: string) {
    try {
      const conversation = await this.conversationModel
        .findById(id)
        .populate('members', 'name email')
        .exec();
      
      if (!conversation) {
        return null;
      }
      
      return conversation.toObject();
    } catch (error) {
      console.error('❌ Error finding conversation:', error);
      return null;
    }
  }

  update(id: number, updateConversationDto: UpdateConversationDto) {
    return `This action updates a #${id} conversation`;
  }

  async remove(id: string, userId: string) {
    try {
      // Find the conversation
      const conversation = await this.conversationModel.findById(id);
      
      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
          data: null
        };
      }
      
      // Check if user is admin (for group conversations) or member (for direct conversations)
      if (conversation.type === ConversationType.GROUP) {
        // For group conversations, only admin can delete
        if (conversation.adminId?.toString() !== userId) {
          return {
            success: false,
            message: 'Only group admin can delete this conversation',
            data: null
          };
        }
      } else {
        // For direct conversations, any member can delete
        if (!conversation.members.includes(userId as any)) {
          return {
            success: false,
            message: 'You are not authorized to delete this conversation',
            data: null
          };
        }
      }
      
      // Delete all messages for this conversation first
      const messageDeleteResult = await this.messageModel.deleteMany({ conversationId: id });
      console.log(`🗑️ Deleted ${messageDeleteResult.deletedCount} messages for conversation: ${id}`);
      
      // Delete the conversation
      await this.conversationModel.findByIdAndDelete(id);
      
      return {
        success: true,
        message: 'Conversation deleted successfully',
        data: null
      };
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      return {
        success: false,
        message: 'Failed to delete conversation',
        data: null
      };
    }
  }

  // Update conversation's updatedAt field when a new message is added
  async updateLastActivity(conversationId: string): Promise<void> {
    try {
      await this.conversationModel.findByIdAndUpdate(
        conversationId,
        { updatedAt: new Date() },
        { new: true }
      );
      console.log(`📅 Updated last activity for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating conversation last activity:', error);
    }
  }
}
