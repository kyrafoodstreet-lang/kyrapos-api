import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum BillTypeFilter {
  ALL = 'ALL',
  RESTAURANT = 'RESTAURANT',
  TRAMPOLINE = 'TRAMPOLINE',
  COIN_GAMES = 'COIN_GAMES',
}

export class QueryBillsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(BillTypeFilter)
  type?: BillTypeFilter = BillTypeFilter.ALL;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;
}

export class DeleteBillDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  hardDelete?: boolean = true;
}
