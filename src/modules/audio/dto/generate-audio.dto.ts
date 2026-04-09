import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateAudioDto {
  @ApiProperty()
  @IsString()
  storyId: string;

  @ApiPropertyOptional({
    description:
      'Optional voice profile id; if omitted uses story.voiceProfileId',
  })
  @IsOptional()
  @IsString()
  voiceProfileId?: string;
}
