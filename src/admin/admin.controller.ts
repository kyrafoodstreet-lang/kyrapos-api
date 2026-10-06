import { Controller, Get, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { QueryBillsDto, DeleteBillDto } from './dto/admin-bills.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('bills')
  @Roles(Role.ADMIN)
  async getUnifiedBills(@Query() query: QueryBillsDto) {
    return this.adminService.getUnifiedBills(query);
  }

  @Get('bills/:type/:id')
  @Roles(Role.ADMIN)
  async getBillDetail(
    @Param('type') type: 'RESTAURANT' | 'TRAMPOLINE' | 'COIN_GAMES',
    @Param('id') id: string,
  ) {
    return this.adminService.getBillDetail(type, id);
  }

  @Delete('bills/:type/:id')
  @Roles(Role.ADMIN)
  async deleteBill(
    @CurrentUser() user: any,
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() dto: DeleteBillDto,
  ) {
    return this.adminService.deleteBill(user, type, id, dto || {});
  }
}
