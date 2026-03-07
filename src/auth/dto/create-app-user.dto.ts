import { IsEmail, IsString, IsBoolean, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateAppUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsBoolean()
  sendInvite?: boolean;
}
