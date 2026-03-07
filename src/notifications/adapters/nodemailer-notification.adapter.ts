import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import {
  ISendNotificationPort,
  SendNotificationCommand,
  SendNotificationResult,
} from '../ports/send-notification.port';
import { TemplateRegistry } from '../templates/template-registry';

@Injectable()
export class NodemailerNotificationAdapter implements ISendNotificationPort {
  private readonly logger = new Logger(NodemailerNotificationAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly templateRegistry: TemplateRegistry;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SPA_SMTP_HOST') ?? config.get<string>('SMTP_HOST', '127.0.0.1');
    const port = config.get<number>('SPA_SMTP_PORT') ?? config.get<number>('SMTP_PORT', 1025);
    const user = config.get<string>('SPA_SMTP_USER') ?? config.get<string>('SMTP_USER', '');
    const pass = config.get<string>('SPA_SMTP_PASS') ?? config.get<string>('SMTP_PASS', '');
    this.from = config.get<string>('SPA_SMTP_FROM') ?? config.get<string>('SMTP_FROM', 'noreply@saintpetter.local');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ...(user ? { auth: { user, pass } } : {}),
    });

    this.templateRegistry = new TemplateRegistry();
  }

  async send(command: SendNotificationCommand): Promise<SendNotificationResult> {
    if (command.channel !== 'email') {
      this.logger.warn(`Channel "${command.channel}" not supported by NodemailerAdapter; skipping.`);
      return { notificationId: randomUUID() };
    }

    if (!command.recipientEmail) {
      this.logger.warn('No recipientEmail provided; skipping email send.');
      return { notificationId: randomUUID() };
    }

    let rendered: { subject: string; html: string; text: string };
    try {
      rendered = this.templateRegistry.render(command.templateKey, command.data);
    } catch (err) {
      this.logger.error(`Template error for key "${command.templateKey}": ${String(err)}`);
      throw err;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: command.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: command.idempotencyKey
          ? { 'X-Idempotency-Key': command.idempotencyKey }
          : {},
      });
      const notificationId = (info.messageId as string | undefined) ?? randomUUID();
      this.logger.log(
        `Email sent [${command.templateKey}] to ${command.recipientEmail} (id=${notificationId})`,
      );
      return { notificationId };
    } catch (err) {
      this.logger.error(`Failed to send email to ${command.recipientEmail}: ${String(err)}`);
      throw err;
    }
  }
}
