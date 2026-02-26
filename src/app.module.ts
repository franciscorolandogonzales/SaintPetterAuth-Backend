import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SessionsModule } from './sessions/sessions.module';
import { UserModule } from './user/user.module';
import { OrganizationModule } from './organization/organization.module';
import { ManagementModule } from './management/management.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { SeedModule } from './seed/seed.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { OneTimeLinkModule } from './one-time-link/one-time-link.module';
import { getDatabaseConfig } from './config/database.config';
import { OrgContextMiddleware } from './auth/org-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(getDatabaseConfig()),
    RedisModule,
    RabbitMQModule,
    AuditModule,
    HealthModule,
    UserModule,
    OrganizationModule,
    ManagementModule,
    AuthModule,
    AuthorizationModule,
    EventsModule,
    NotificationsModule,
    SessionsModule,
    SeedModule,
    OneTimeLinkModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OrgContextMiddleware)
      .forRoutes(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/app/users', method: RequestMethod.POST },
        { path: 'authorization/check', method: RequestMethod.POST },
      );
  }
}
