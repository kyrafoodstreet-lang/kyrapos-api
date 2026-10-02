import { IsEmail, IsNotEmpty, MinLength, IsBoolean, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsBoolean()
  @IsOptional()
  alwaysLogin?: boolean;
}
