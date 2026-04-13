import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class FeatureStoryDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}
