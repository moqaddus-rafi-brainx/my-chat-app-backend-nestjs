import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessageModule } from '../message/message.module';
import { AuthModule } from '../auth/auth.module';
import { WebSocketConnectionManager } from './websocket-connection.manager';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [forwardRef(() => MessageModule), AuthModule, forwardRef(() => ConversationModule)],
  providers: [ChatGateway, WebSocketConnectionManager],
  exports: [ChatGateway, WebSocketConnectionManager],
})
export class ChatModule {}
