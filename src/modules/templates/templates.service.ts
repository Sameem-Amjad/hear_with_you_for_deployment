import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(query: ListTemplatesQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.StoryTemplateWhereInput = {
      isActive: true,
      isPublished: true,
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                templatePrompt: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                templateSvg: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.storyTemplate.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prismaService.storyTemplate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async get(id: string) {
    const template = await this.prismaService.storyTemplate.findUnique({
      where: { id },
    });

    if (!template || !template.isActive || !template.isPublished) {
      throw new NotFoundException('Template not found');
    }

    return { template };
  }
}
