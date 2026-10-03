import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CoinSaleItemDto {
  @IsString()
  @IsNotEmpty()
  package!: string; // 'coin-1' | 'coin-4' | 'coin-10'

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateCoinSaleDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerMobile?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoinSaleItemDto)
  items!: CoinSaleItemDto[];

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string; // CASH, UPI, CASH_AND_UPI

  @IsNumber()
  @Min(0)
  @IsOptional()
  cashAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  upiAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

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

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  parentName?: string;

  @IsString()
  @IsOptional()
  childName?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  gender?: string; // MALE, FEMALE, OTHER
}

export class ValidateOfferDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
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
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerMobile?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerParentName?: string;

  @IsString()
  @IsOptional()
  customerChildName?: string;

  @IsString()
  @IsOptional()
  gameId?: string;

  @IsString()
  @IsOptional()
  pricingId?: string;

  @IsString()
  @IsOptional()
  zone?: string;

  @IsString()
  @IsOptional()
  coinPackageId?: string;

  @IsOptional()
  coinQuantities?: Record<string, number>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  adultCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  childCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  guestCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duration?: number; // duration in minutes (0 for coin packages, 30, 60, 90, 120 for time-based)

  @IsString()
  @IsOptional()
  offerCode?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  socksCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  socksPrice?: number;

  // Real-time calculations & overrides (Manual manager discount)
  @IsNumber()
  @Min(0)
  @IsOptional()
  manualDiscount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  // Payments details
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string; // CASH, UPI, CASH_AND_UPI

  @IsNumber()
  @Min(0)
  @IsOptional()
  cashAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  upiAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  // Manager Override authorization payload if cashier attempts manual discount
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

export class CloseGameDayDto {
  @IsString()
  @IsOptional()
  date?: string; // YYYY-MM-DD (defaults to today)

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCash?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualUpi?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualTrampCash?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualTrampUpi?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCoinCash?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCoinUpi?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePublicBookingDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  mobile!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  gameId?: string;

  @IsString()
  @IsOptional()
  pricingId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  adultCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  childCount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

