import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SearchMessagesDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  conversationId?: string; // Optional: search within specific conversation
}
