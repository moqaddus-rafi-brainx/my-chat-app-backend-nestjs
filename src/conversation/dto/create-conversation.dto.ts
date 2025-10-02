import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ConversationType } from "../../constants";

export class CreateConversationDto {
    @IsString()
    @IsOptional()
    name: string;

    @IsNotEmpty()
    members: string[];

    @IsNotEmpty()
    @IsString()
    @IsEnum(ConversationType)
    type: ConversationType;
}
