import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class CreateUploadSessionDto {
  @ApiProperty({ example: 'sample-1.mp3' })
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'audio/mpeg', enum: ['audio/mpeg', 'audio/wav'] })
  @IsString()
  @IsIn(['audio/mpeg', 'audio/wav'])
  contentType!: string;

  @ApiProperty({ example: 3500000, minimum: 1, maximum: 10485760 })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number;
}
