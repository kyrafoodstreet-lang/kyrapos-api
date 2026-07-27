import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { DishesService } from './dishes.service';
import { CreateDishDto, UpdateDishDto, BulkImportMenuDto } from './dto/dishes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

@Controller('dishes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DishesController {
  constructor(private dishesService: DishesService) {}

  @Get()
  async findAll() {
    return this.dishesService.findAll();
  }

  @Get('available')
  async findAvailable() {
    return this.dishesService.findAvailable();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.dishesService.findOne(id);
  }

  @Post('upload')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `dish-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    const host = req.get('host');
    const protocol = req.protocol;
    const url = `${protocol}://${host}/uploads/${file.filename}`;
    return { url };
  }

  @Post('bulk-import')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkImport(@Body() dto: BulkImportMenuDto) {
    return this.dishesService.bulkImportMenu(dto);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() dto: CreateDishDto) {
    return this.dishesService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdateDishDto) {
    return this.dishesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async remove(@Param('id') id: string) {
    return this.dishesService.remove(id);
  }
}

