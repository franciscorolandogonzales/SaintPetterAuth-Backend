export class AuthorizationCheckRequestDto {
  actions!: string[];
  resource!: string;
}

export class AuthorizationCheckResponseDto {
  allowed!: boolean;
}
