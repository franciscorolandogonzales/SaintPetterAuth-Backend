export type NotificationChannel = 'email' | 'telegram';
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface SendNotificationCommand {
  channel: NotificationChannel;
  priority: NotificationPriority;
  templateKey: string;
  data: Record<string, unknown>;
  idempotencyKey?: string;
  recipientEmail?: string;
  recipientTelegramChatId?: string;
}

export interface SendNotificationResult {
  notificationId: string;
}

export const SEND_NOTIFICATION_PORT = 'SendNotificationPort';

export interface ISendNotificationPort {
  send(command: SendNotificationCommand): Promise<SendNotificationResult>;
}
