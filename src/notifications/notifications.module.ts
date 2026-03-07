import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationConsumer } from './notification.consumer';
import { SEND_NOTIFICATION_PORT } from './ports/send-notification.port';
import { LogNotificationAdapter } from './adapters/log-notification.adapter';
import { NodemailerNotificationAdapter } from './adapters/nodemailer-notification.adapter';
import { AuthModule } from '../auth/auth.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [ConfigModule, RabbitMQModule, UserModule, OrganizationModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationConsumer,
    {
      provide: SEND_NOTIFICATION_PORT,
      useFactory: (config: ConfigService) => {
        const smtpHost = config.get<string>('SPA_SMTP_HOST') ?? config.get<string>('SMTP_HOST');
        if (smtpHost) {
          return new NodemailerNotificationAdapter(config);
        }
        return new LogNotificationAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
