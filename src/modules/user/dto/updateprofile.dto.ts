import { PartialType } from '@nestjs/swagger';
import { SetupProfileDto } from './setupprofile.dto';

export class UpdateProfileDto extends PartialType(SetupProfileDto) {}
