import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { GenerateStoryDto } from '../../story/dto/generate-story.dto';

export class FullStoryRequestDto extends GenerateStoryDto {
  @ApiPropertyOptional({
    description: 'If true, also generate audio (default true)',
  })
  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean = true;

  @ApiPropertyOptional({
    description: 'Optional voice profile id for audio generation',
  })
  @IsOptional()
  @IsString()
  voiceProfileId?: string;
}
