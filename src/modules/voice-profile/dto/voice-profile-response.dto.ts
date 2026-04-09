import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoiceProfile, VoiceStatus, VoiceType } from '@prisma/client';

export class VoiceProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: VoiceType })
  type: VoiceType;

  @ApiProperty({ enum: VoiceStatus })
  status: VoiceStatus;

  @ApiPropertyOptional()
  elevenLabsVoiceId?: string | null;

  @ApiProperty()
  sampleAudioUrls: string[];

  @ApiPropertyOptional()
  sampleDuration?: number | null;

  @ApiProperty()
  stability: number;

  @ApiProperty()
  similarityBoost: number;

  @ApiProperty()
  style: number;

  @ApiProperty()
  useSpeakerBoost: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: VoiceProfile): VoiceProfileResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      status: entity.status,
      elevenLabsVoiceId: entity.elevenLabsVoiceId,
      sampleAudioUrls: entity.sampleAudioUrls,
      sampleDuration: entity.sampleDuration,
      stability: entity.stability,
      similarityBoost: entity.similarityBoost,
      style: entity.style,
      useSpeakerBoost: entity.useSpeakerBoost,
      isActive: entity.isActive,
      isDefault: entity.isDefault,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
