export class SendNotificationRequestDto {
  channel!: 'email' | 'telegram';
  priority!: 'critical' | 'high' | 'normal' | 'low';
  templateKey!: string;
  data!: Record<string, unknown>;
  idempotencyKey?: string;
}

export class SendNotificationResponseDto {
  notificationId!: string;
}
