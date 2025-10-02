import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    ) {}

    create(createConversationDto: CreateConversationDto, userId: string): Promise<Conversation> {
        const { name, members, type } = createConversationDto;
        const participants = [userId, ...members];
        const conversation = new this.conversationModel({ name, type, members: participants });
        return conversation.save();
    }

  //Get all conversations for a user.
  findAll(userId: string) {
    return this.conversationModel.find({ members: { $in: [userId] } }).exec();
  }

  findOne(id: number) {
    return `This action returns a #${id} conversation`;
  }

  update(id: number, updateConversationDto: UpdateConversationDto) {
    return `This action updates a #${id} conversation`;
  }

  remove(id: number) {
    return `This action removes a #${id} conversation`;
  }
}
