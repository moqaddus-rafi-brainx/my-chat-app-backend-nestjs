import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';

@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async create(
    @Body() createMessageDto: CreateMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.messageService.create(createMessageDto, user.id);
  }

  @Get('conversation/:conversationId')
  async findAllByConversation(@Param('conversationId') conversationId: string) {
    return this.messageService.findAllByConversation(conversationId);
  }
}
