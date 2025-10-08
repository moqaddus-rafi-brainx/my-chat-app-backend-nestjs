import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message, MessageDocument } from '../schemas/message.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { ConversationService } from '../conversation/conversation.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
      const result = await this.messageModel.deleteMany({ conversationId });
      console.log(`🗑️ Deleted ${result.deletedCount} messages for conversation: ${conversationId}`);
      return {
        success: true,
        message: `Deleted ${result.deletedCount} messages successfully`,
        data: { deletedCount: result.deletedCount }
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
}
