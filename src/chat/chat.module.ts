import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessageModule } from '../message/message.module';
import { AuthModule } from '../auth/auth.module';
import { WebSocketConnectionManager } from './websocket-connection.manager';
import { WebSocketBroadcastService } from './websocket-broadcast.service';
import { ConversationModule } from '../conversation/conversation.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    forwardRef(() => MessageModule), 
    AuthModule, 
    forwardRef(() => ConversationModule),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
  ],
  providers: [ChatGateway, WebSocketConnectionManager, WebSocketBroadcastService],
  exports: [ChatGateway, WebSocketConnectionManager, WebSocketBroadcastService],
})
export class ChatModule {}
