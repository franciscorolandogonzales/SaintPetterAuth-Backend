import { IsString, MinLength, MaxLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  @MinLength(1, { message: 'Token is required' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
