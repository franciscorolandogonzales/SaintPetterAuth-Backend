import { IsString, Length } from 'class-validator';

export class MfaTotpEnrollResponseDto {
  secret!: string;
  qrDataUrl!: string;
}

export class MfaTotpVerifyRequestDto {
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be 6 digits' })
  code!: string;
}
