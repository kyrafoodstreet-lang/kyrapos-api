import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, OrderStatus, PaymentMethod } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  dishId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsEnum(OrderType)
  @IsNotEmpty()
  type!: OrderType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountTotal?: number;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;
}

export class CompletePaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  method!: PaymentMethod;

  @IsOptional()
  details?: any;
}

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
