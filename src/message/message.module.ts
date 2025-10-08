import { Module, forwardRef } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from '../schemas/message.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => ConversationModule),
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
