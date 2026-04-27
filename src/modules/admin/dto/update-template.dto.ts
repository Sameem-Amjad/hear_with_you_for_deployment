import { PartialType } from '@nestjs/swagger';
import { UpsertTemplateDto } from './upsert-template.dto';

export class UpdateTemplateDto extends PartialType(UpsertTemplateDto) {}
