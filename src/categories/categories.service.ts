import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findActive() {
    return this.prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }
    return this.prisma.category.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.prisma.category.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }
    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
