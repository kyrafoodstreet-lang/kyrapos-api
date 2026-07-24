import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  @IsNotEmpty()
  category!: ExpenseCategory;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  date?: string;
}
