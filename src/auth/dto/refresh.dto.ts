import { IsString, MinLength } from 'class-validator';

export class RefreshRequestDto {
  @IsString()
  @MinLength(1, { message: 'Refresh token is required' })
  refreshToken!: string;
}
