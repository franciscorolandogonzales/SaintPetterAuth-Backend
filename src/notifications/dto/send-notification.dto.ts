import {
  IsIn,
  IsString,
  IsObject,
  IsOptional,
  MinLength,
} from 'class-validator';

export class SendNotificationRequestDto {
  @IsIn(['email', 'telegram'])
  channel!: 'email' | 'telegram';

  @IsIn(['critical', 'high', 'normal', 'low'])
  priority!: 'critical' | 'high' | 'normal' | 'low';

  @IsString()
  @MinLength(1, { message: 'Template key is required' })
  templateKey!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class SendNotificationResponseDto {
  notificationId!: string;
}
