import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgeGroup, StoryDuration, StoryTheme } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateStoryDto {
  @ApiPropertyOptional({ enum: StoryTheme })
  @IsOptional()
  @IsEnum(StoryTheme)
  theme?: StoryTheme;

  @ApiPropertyOptional({ enum: AgeGroup })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional({ enum: StoryDuration, default: StoryDuration.MEDIUM })
  @IsOptional()
  @IsEnum(StoryDuration)
  duration?: StoryDuration = StoryDuration.MEDIUM;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string = 'en';

  @ApiPropertyOptional({ description: 'Optional story template id from /templates' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Optional child profile id for personalization',
  })
  @IsOptional()
  @IsString()
  childProfileId?: string;

  @ApiPropertyOptional({ description: 'Optional custom user prompt additions' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customPrompt?: string;
}
