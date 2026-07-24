import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto, CloseShiftDto } from './dto/shifts.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User, Role } from '@prisma/client';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get('active')
  async getActiveShift(@CurrentUser() user: any) {
    return this.shiftsService.getActiveShift(user.id);
  }

  @Post('open')
  async openShift(@CurrentUser() user: any, @Body() dto: OpenShiftDto) {
    return this.shiftsService.openShift(user.id, dto);
  }

  @Post('close')
  async closeShift(@CurrentUser() user: any, @Body() dto: CloseShiftDto) {
    return this.shiftsService.closeShift(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findAll(@CurrentUser() user: any) {
    if (user.role === Role.CASHIER) {
      return this.shiftsService.findAll(user.id);
    }
    return this.shiftsService.findAll();
  }

  @Post('approve/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async approveShift(@Param('id') id: string, @CurrentUser() user: any) {
    return this.shiftsService.approveShift(id, user.id);
  }
}
