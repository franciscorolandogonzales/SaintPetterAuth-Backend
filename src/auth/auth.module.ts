import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AuthGuard } from './auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { ApiKeyService } from './api-key.service';
import { GoogleStrategy } from './google.strategy';
import { MfaService } from './mfa.service';
import { OrgContextMiddleware } from './org-context.middleware';
import { RedirectAllowlistService } from './redirect-allowlist.service';
import { GoogleAuthGuard } from './google-auth.guard';
import { AllowedRedirectUriEntity } from './allowed-redirect-uri.entity';
import { AllowedRedirectUriRepository } from './allowed-redirect-uri.repository';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { OneTimeLinkModule } from '../one-time-link/one-time-link.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AllowedRedirectUriEntity]),
    PassportModule,
    UserModule,
    OrganizationModule,
    OneTimeLinkModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => EventsModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthGuard,
    PlatformAdminGuard,
    ApiKeyService,
    GoogleStrategy,
    MfaService,
    OrgContextMiddleware,
    RedirectAllowlistService,
    GoogleAuthGuard,
    AllowedRedirectUriRepository,
  ],
  exports: [
    TokenService,
    AuthGuard,
    PlatformAdminGuard,
    ApiKeyService,
    OrgContextMiddleware,
    RedirectAllowlistService,
    GoogleAuthGuard,
    AllowedRedirectUriRepository,
  ],
})
export class AuthModule {}
