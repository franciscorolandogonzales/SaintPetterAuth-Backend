export class PasswordResetRequestDto {
  email!: string;
}

export class PasswordResetConfirmDto {
  token!: string;
  newPassword!: string;
}
