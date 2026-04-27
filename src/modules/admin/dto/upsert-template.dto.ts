import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertTemplateDto {
  @ApiProperty({ description: 'Template name', required: false, default: '' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Template prompt/content' })
  @IsString()
  templatePrompt: string;

  @ApiProperty({ required: false, description: 'Raw SVG markup' })
  @IsOptional()
  @IsString()
  templateSvg?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'SVG file upload that will be stored and saved as templateSvg',
  })
  @IsOptional()
  @IsString()
  templateSvgFile?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
