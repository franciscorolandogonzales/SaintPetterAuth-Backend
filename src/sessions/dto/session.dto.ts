export class SessionDto {
  id!: string;
  createdAt!: string;
  lastActiveAt?: string;
  userAgent?: string | null;
}

export class SessionListResponseDto {
  sessions!: SessionDto[];
}
