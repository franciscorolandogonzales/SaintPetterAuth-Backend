import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  ISendNotificationPort,
  SendNotificationCommand,
  SEND_NOTIFICATION_PORT,
} from './ports/send-notification.port';
import { RabbitMQService, NOTIFICATION_QUEUE } from '../rabbitmq/rabbitmq.service';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    @Inject(SEND_NOTIFICATION_PORT)
    private readonly sender: ISendNotificationPort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.rabbitmq.isEnabled) {
      this.logger.log('RabbitMQ disabled; NotificationConsumer inactive.');
      return;
    }
    this.logger.log(`Starting consumer on queue "${NOTIFICATION_QUEUE}"...`);
    await this.rabbitmq.consume(NOTIFICATION_QUEUE, (payload) =>
      this.handle(payload as SendNotificationCommand),
    );
  }

  private async handle(command: SendNotificationCommand): Promise<void> {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await this.sender.send(command);
        this.logger.log(
          `Notification delivered [${command.templateKey}] to ${command.recipientEmail ?? command.recipientTelegramChatId ?? 'unknown'}`,
        );
        return;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          this.logger.error(
            `Notification failed after ${MAX_RETRIES} attempts [${command.templateKey}]: ${String(err)}`,
          );
          return; // message will be nack'd by RabbitMQService.consume
        }
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Retry ${attempt}/${MAX_RETRIES} for [${command.templateKey}] in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
}
