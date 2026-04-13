import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RespondFeedbackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  response: string;

  @ApiProperty({ example: 'resolved' })
  @IsString()
  status: string;
}
