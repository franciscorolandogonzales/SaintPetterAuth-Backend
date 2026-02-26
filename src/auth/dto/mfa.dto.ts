export class MfaTotpEnrollResponseDto {
  secret!: string;
  qrDataUrl!: string;
}

export class MfaTotpVerifyRequestDto {
  code!: string;
}
