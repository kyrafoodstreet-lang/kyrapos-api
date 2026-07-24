import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto, UpdateTableDto } from './dto/tables.dto';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.table.findMany({
      where: { deletedAt: null },
      orderBy: { number: 'asc' },
    });
  }

  async findOne(id: string) {
    const table = await this.prisma.table.findFirst({
      where: { id, deletedAt: null },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }

  async create(dto: CreateTableDto) {
    const existing = await this.prisma.table.findFirst({
      where: { number: dto.number, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Table with this number already exists');
    }
    return this.prisma.table.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.findOne(id);
    if (dto.number) {
      const existing = await this.prisma.table.findFirst({
        where: { number: dto.number, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Table with this number already exists');
      }
    }
    return this.prisma.table.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.table.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
