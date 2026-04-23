import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CompleteUploadVoiceProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Voice type code for mobile mapping (0-6)',
    minimum: 0,
    maximum: 6,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  type?: number;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  tone?: string[];

  @ApiProperty({
    type: [String],
    description: 'Uploaded object keys from DigitalOcean Spaces',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  objectKeys: string[];
}
