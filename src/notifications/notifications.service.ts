import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ISendNotificationPort,
  SendNotificationCommand,
  SendNotificationResult,
  NotificationPriority,
  SEND_NOTIFICATION_PORT,
} from './ports/send-notification.port';
import {
  SendNotificationRequestDto,
  SendNotificationResponseDto,
} from './dto/send-notification.dto';
import { RabbitMQService, NOTIFICATION_QUEUE } from '../rabbitmq/rabbitmq.service';

const PRIORITY_MAP: Record<NotificationPriority, number> = {
  critical: 10,
  high: 7,
  normal: 4,
  low: 1,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(SEND_NOTIFICATION_PORT)
    private readonly sender: ISendNotificationPort,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async send(dto: SendNotificationRequestDto): Promise<SendNotificationResponseDto> {
    const command: SendNotificationCommand = {
      channel: dto.channel,
      priority: dto.priority,
      templateKey: dto.templateKey,
      data: dto.data,
      idempotencyKey: dto.idempotencyKey,
    };
    const result = await this.dispatch(command);
    return { notificationId: result.notificationId };
  }

  /**
   * Send from application code (e.g. auth flow). Caller provides recipient.
   */
  async sendToRecipient(
    channel: 'email' | 'telegram',
    priority: NotificationPriority,
    templateKey: string,
    data: Record<string, unknown>,
    options: { email?: string; telegramChatId?: string; idempotencyKey?: string },
  ): Promise<SendNotificationResult> {
    const command: SendNotificationCommand = {
      channel,
      priority,
      templateKey,
      data,
      idempotencyKey: options.idempotencyKey ?? randomUUID(),
      recipientEmail: options.email,
      recipientTelegramChatId: options.telegramChatId,
    };
    return this.dispatch(command);
  }

  private async dispatch(command: SendNotificationCommand): Promise<SendNotificationResult> {
    if (this.rabbitmq.isEnabled) {
      const priority = PRIORITY_MAP[command.priority] ?? 4;
      const published = await this.rabbitmq.publish(NOTIFICATION_QUEUE, command, priority);
      if (published) {
        this.logger.log(`Notification queued [${command.templateKey}] priority=${command.priority}`);
        return { notificationId: command.idempotencyKey ?? randomUUID() };
      }
      this.logger.warn('RabbitMQ publish failed; falling back to synchronous send.');
    }
    return this.sender.send(command);
  }
}
