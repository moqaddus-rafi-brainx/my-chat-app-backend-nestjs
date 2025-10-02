import { PartialType } from '@nestjs/mapped-types';
import { CreateConversationDto } from './create-conversation.dto';
import { IsNotEmpty } from 'class-validator';

export class UpdateConversationDto extends PartialType(CreateConversationDto) {
    @IsNotEmpty()
    members: string[];
}
