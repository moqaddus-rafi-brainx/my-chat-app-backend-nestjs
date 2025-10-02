import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message, MessageDocument } from '../schemas/message.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createMessageDto: CreateMessageDto, senderId: string): Promise<Message> {
    const { content, conversationId } = createMessageDto;

    // Verify sender exists
    const sender = await this.userModel.findById(senderId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    const message = new this.messageModel({
      content,
      senderId,
      conversationId,
    });

    return message.save();
  }

  async findAllByConversation(conversationId: string): Promise<Message[]> {
    const messages = await this.messageModel
      .find({ conversationId })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 })
      .exec();

    return messages;
  }
}
