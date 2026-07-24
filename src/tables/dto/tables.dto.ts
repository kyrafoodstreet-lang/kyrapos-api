import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsNumber()
  @Min(1)
  capacity!: number;
}

export class UpdateTableDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  capacity?: number;

  @IsEnum(TableStatus)
  @IsOptional()
  status?: TableStatus;
}
