import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDishDto, UpdateDishDto, BulkImportMenuDto } from './dto/dishes.dto';

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

  async bulkImportMenu(dto: BulkImportMenuDto) {
    let categoriesCreated = 0;
    let categoriesUpdated = 0;
    let dishesCreated = 0;
    let dishesUpdated = 0;
    const errors: string[] = [];

    const categoryMap = new Map<string, string>();

    const existingCats = await this.prisma.category.findMany({
      where: { deletedAt: null },
    });
    existingCats.forEach((c) => categoryMap.set(c.name.trim().toLowerCase(), c.id));

    if (dto.categories && Array.isArray(dto.categories)) {
      for (const catDto of dto.categories) {
        if (!catDto.name || !catDto.name.trim()) continue;
        const normalizedName = catDto.name.trim();
        const key = normalizedName.toLowerCase();

        if (categoryMap.has(key)) {
          const existingId = categoryMap.get(key)!;
          await this.prisma.category.update({
            where: { id: existingId },
            data: {
              description: catDto.description !== undefined ? catDto.description : undefined,
              isActive: catDto.isActive !== undefined ? catDto.isActive : true,
            },
          });
          categoriesUpdated++;
        } else {
          const newCat = await this.prisma.category.create({
            data: {
              name: normalizedName,
              description: catDto.description || null,
              isActive: catDto.isActive ?? true,
            },
          });
          categoryMap.set(key, newCat.id);
          categoriesCreated++;
        }
      }
    }

    if (dto.dishes && Array.isArray(dto.dishes)) {
      for (const dishDto of dto.dishes) {
        try {
          if (!dishDto.name || !dishDto.name.trim()) continue;
          const dishName = dishDto.name.trim();

          let categoryId = dishDto.categoryId;
          if (!categoryId && dishDto.categoryName) {
            const catKey = dishDto.categoryName.trim().toLowerCase();
            if (categoryMap.has(catKey)) {
              categoryId = categoryMap.get(catKey);
            } else {
              const newCat = await this.prisma.category.create({
                data: { name: dishDto.categoryName.trim() },
              });
              categoryId = newCat.id;
              categoryMap.set(catKey, newCat.id);
              categoriesCreated++;
            }
          }

          if (!categoryId) {
            const catKey = 'general';
            if (categoryMap.has(catKey)) {
              categoryId = categoryMap.get(catKey);
            } else {
              const defaultCat = await this.prisma.category.create({
                data: { name: 'General' },
              });
              categoryId = defaultCat.id;
              categoryMap.set(catKey, defaultCat.id);
              categoriesCreated++;
            }
          }

          const existingDish = await this.prisma.dish.findFirst({
            where: { name: dishName, deletedAt: null },
          });

          if (existingDish) {
            await this.prisma.dish.update({
              where: { id: existingDish.id },
              data: {
                description: dishDto.description !== undefined ? dishDto.description : existingDish.description,
                price: dishDto.price !== undefined ? dishDto.price : existingDish.price,
                taxRate: dishDto.taxRate !== undefined ? dishDto.taxRate : existingDish.taxRate,
                isAvailable: dishDto.isAvailable !== undefined ? dishDto.isAvailable : existingDish.isAvailable,
                preparationTime: dishDto.preparationTime !== undefined ? dishDto.preparationTime : existingDish.preparationTime,
                imageUrl: dishDto.imageUrl !== undefined ? dishDto.imageUrl : existingDish.imageUrl,
                categoryId: categoryId,
              },
            });
            dishesUpdated++;
          } else {
            await this.prisma.dish.create({
              data: {
                name: dishName,
                description: dishDto.description || null,
                price: dishDto.price || 0,
                taxRate: dishDto.taxRate ?? 0,
                isAvailable: dishDto.isAvailable ?? true,
                preparationTime: dishDto.preparationTime ?? 15,
                imageUrl: dishDto.imageUrl || null,
                categoryId: categoryId!,
              },
            });
            dishesCreated++;
          }
        } catch (err: any) {
          errors.push(`Failed to import dish "${dishDto.name}": ${err.message}`);
        }
      }
    }

    return {
      success: true,
      categoriesCreated,
      categoriesUpdated,
      dishesCreated,
      dishesUpdated,
      errors,
    };
  }
}

