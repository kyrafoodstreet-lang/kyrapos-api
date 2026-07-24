import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDishDto, UpdateDishDto } from './dto/dishes.dto';

@Injectable()
export class DishesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.dish.findMany({
      where: { deletedAt: null },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAvailable() {
    return this.prisma.dish.findMany({
      where: { deletedAt: null, isAvailable: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const dish = await this.prisma.dish.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }
    return dish;
  }

  async create(dto: CreateDishDto) {
    const existing = await this.prisma.dish.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Dish with this name already exists');
    }

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException('Selected category does not exist');
    }

    return this.prisma.dish.create({
      data: {
        ...dto,
        isAvailable: dto.isAvailable ?? true,
        taxRate: dto.taxRate ?? 0,
        preparationTime: dto.preparationTime ?? 15,
      },
    });
  }

  async update(id: string, dto: UpdateDishDto) {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.prisma.dish.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Dish with this name already exists');
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, deletedAt: null },
      });
      if (!category) {
        throw new NotFoundException('Selected category does not exist');
      }
    }

    return this.prisma.dish.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.dish.update({
      where: { id },
      data: { deletedAt: new Date(), isAvailable: false },
    });
  }
}
