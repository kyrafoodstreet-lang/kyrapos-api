import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenShiftDto {
  @IsNumber()
  @Min(0)
  openingCash!: number;
}

export class CloseShiftDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  closingCashSales?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  closingCardSales?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  closingUpiSales?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  closingExpenses?: number;

  @IsNumber()
  @Min(0)
  actualCash!: number;

  @IsNumber()
  @Min(0)
  actualUpi!: number;

  @IsString()
  @IsOptional()
  closingNotes?: string;
}
