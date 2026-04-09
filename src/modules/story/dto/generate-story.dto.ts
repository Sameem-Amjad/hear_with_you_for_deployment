import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgeGroup, StoryDuration, StoryTheme } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateStoryDto {
  @ApiProperty({ enum: StoryTheme })
  @IsEnum(StoryTheme)
  theme: StoryTheme;

  @ApiProperty({ enum: AgeGroup })
  @IsEnum(AgeGroup)
  ageGroup: AgeGroup;

  @ApiPropertyOptional({ enum: StoryDuration, default: StoryDuration.MEDIUM })
  @IsOptional()
  @IsEnum(StoryDuration)
  duration?: StoryDuration = StoryDuration.MEDIUM;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string = 'en';

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
