import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class RemoveMemberDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  memberIds: string[];
}
