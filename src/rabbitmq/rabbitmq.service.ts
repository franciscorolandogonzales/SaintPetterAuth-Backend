import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

export const NOTIFICATION_QUEUE = 'notifications';
const MAX_PRIORITY = 10;
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private readonly url: string | undefined;
  private model: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private reconnectAttempts = 0;
  private destroyed = false;

  constructor(private readonly config: ConfigService) {
    this.url = config.get<string>('SPA_RABBITMQ_URL') ?? config.get<string>('RABBITMQ_URL');
  }

  get isEnabled(): boolean {
    return !!this.url;
  }

  async onModuleInit(): Promise<void> {
    if (!this.url) {
      this.logger.warn('SPA_RABBITMQ_URL not set; RabbitMQ integration disabled (sync fallback active).');
      return;
    }
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    try {
      this.model = await amqplib.connect(this.url!);
      this.channel = await this.model.createChannel();
      await this.channel.assertQueue(NOTIFICATION_QUEUE, {
        durable: true,
        arguments: { 'x-max-priority': MAX_PRIORITY },
      });
      this.reconnectAttempts = 0;
      this.logger.log(`Connected to RabbitMQ; queue "${NOTIFICATION_QUEUE}" ready.`);

      this.model.on('error', (err: Error) => {
        this.logger.error(`RabbitMQ connection error: ${String(err)}`);
        void this.handleDisconnect();
      });
      this.model.on('close', () => {
        if (!this.destroyed) {
          this.logger.warn('RabbitMQ connection closed; reconnecting...');
          void this.handleDisconnect();
        }
      });
    } catch (err) {
      this.logger.error(`Failed to connect to RabbitMQ: ${String(err)}`);
      await this.handleDisconnect();
    }
  }

  private async handleDisconnect(): Promise<void> {
    this.model = null;
    this.channel = null;
    if (this.destroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max RabbitMQ reconnect attempts reached; giving up.');
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    this.logger.log(`Reconnecting to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts})...`);
    await new Promise((r) => setTimeout(r, delay));
    await this.connect();
  }

  async publish(queue: string, message: unknown, priority: number): Promise<boolean> {
    if (!this.channel) return false;
    const content = Buffer.from(JSON.stringify(message));
    return this.channel.sendToQueue(queue, content, {
      persistent: true,
      priority: Math.min(Math.max(priority, 0), MAX_PRIORITY),
    });
  }

  async consume(
    queue: string,
    handler: (message: unknown) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) return;
    const ch = this.channel;
    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as unknown;
        await handler(payload);
        ch.ack(msg);
      } catch (err) {
        this.logger.error(`Error processing message from "${queue}": ${String(err)}`);
        ch.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    try {
      await this.channel?.close();
      await this.model?.close();
    } catch (_err) {
      // Ignore errors on shutdown
    }
  }
}
