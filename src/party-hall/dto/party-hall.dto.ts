import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHallDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(1)
  capacity!: number;

  @IsNumber()
  @Min(0)
  baseRent!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateHallDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  baseRent?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CustomServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  cost!: number;
}

export class CreateBookingDto {
  // Customer Info
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerMobile!: string;

  @IsString()
  @IsOptional()
  customerAltMobile?: string;

  @IsString()
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  // Event Info
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  bookingDate!: string; // ISO string or date string

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  hallId!: string;

  @IsNumber()
  @Min(1)
  guestCount!: number;

  // Charges
  @IsNumber()
  @Min(0)
  @IsOptional()
  decorCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  foodCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  soundCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  generatorCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cleaningCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  extraCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gst?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  advancePaid?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CustomServiceDto)
  services?: CustomServiceDto[];
}

export class UpdateBookingStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string; // RESERVED, BOOKED, CANCELLED
}

export class CreatePaymentDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  method!: string; // CASH, CARD, UPI, BANK_TRANSFER

  @IsString()
  @IsOptional()
  notes?: string;
}
