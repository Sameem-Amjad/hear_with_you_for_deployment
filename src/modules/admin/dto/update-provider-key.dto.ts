import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateProviderKeyDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  apiKey: string;
}
