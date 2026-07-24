import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateGameDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreatePricingDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  duration!: number; // duration in minutes

  @IsNumber()
  @Min(0)
  price!: number;
}

export class UpdatePricingDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duration?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  mobile!: string;

  @IsNumber()
  @Min(1)
  age!: number;

  @IsString()
  @IsNotEmpty()
  gender!: string; // MALE, FEMALE, OTHER
}

export class ManagerOverrideDto {
  @IsString()
  @IsNotEmpty()
  username!: string; // email of the override user

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsString()
  @IsNotEmpty()
  pricingId!: string;

  @IsNumber()
  @Min(1)
  guestCount!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  // Real-time calculations & overrides
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gst?: number;

  // Payments details
  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string; // CASH, CARD, UPI, BANK_TRANSFER

  // Manager Override authorization payload if cashier attempts discount
  @IsOptional()
  overrideAuth?: ManagerOverrideDto;
}

export class CloseSessionDto {
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
  amountPaid?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
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
