import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TablesService } from './tables.service';
import { CreateTableDto, UpdateTableDto } from './dto/tables.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Get()
  async findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async remove(@Param('id') id: string) {
    return this.tablesService.remove(id);
  }
}
