import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ISendNotificationPort,
  SendNotificationCommand,
  SendNotificationResult,
} from '../ports/send-notification.port';

/**
 * Development adapter: logs notification to console and returns a fake id.
 * Replace with email/Telegram adapters in production.
 */
@Injectable()
export class LogNotificationAdapter implements ISendNotificationPort {
  async send(command: SendNotificationCommand): Promise<SendNotificationResult> {
    // eslint-disable-next-line no-console
    console.log('[LogNotificationAdapter]', {
      channel: command.channel,
      priority: command.priority,
      templateKey: command.templateKey,
      recipient: command.recipientEmail ?? command.recipientTelegramChatId,
      data: command.data,
    });
    return { notificationId: randomUUID() };
  }
}
