import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../user/user.repository';
import { CredentialRepository } from '../user/credential.repository';
import { SessionRepository } from '../user/session.repository';
import { UserEntity } from '../user/user.entity';
import { CredentialEntity } from '../user/credential.entity';
import { SessionEntity } from '../user/session.entity';
import { TokenService } from './token.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from '../events/events.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationProvisionService } from '../organization/organization-provision.service';
import { RoleRepository } from '../organization/role.repository';
import { OneTimeLinkService } from '../one-time-link/one-time-link.service';
import { RegisterRequestDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

const SALT_ROUNDS = 10;

export interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly credentialRepo: CredentialRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
    private readonly provisionService: OrganizationProvisionService,
    private readonly roleRepo: RoleRepository,
    private readonly oneTimeLinkService: OneTimeLinkService,
  ) {}

  async register(dto: RegisterRequestDto): Promise<TokenResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = new UserEntity();
    user.email = email;
    user.emailVerified = false;
    const savedUser = await this.userRepo.save(user);

    const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const cred = new CredentialEntity();
    cred.userId = savedUser.id;
    cred.passwordHash = hash;
    await this.credentialRepo.save(cred);

    const session = new SessionEntity();
    session.userId = savedUser.id;
    session.userAgent = null;
    const savedSession = await this.sessionRepo.save(session);

    const accessToken = this.tokenService.generateOpaqueToken();
    const refreshToken = this.tokenService.generateOpaqueToken();
    await this.tokenService.storeAccessToken(
      accessToken,
      savedUser.id,
      savedSession.id,
    );
    await this.tokenService.storeRefreshToken(
      refreshToken,
      savedUser.id,
      savedSession.id,
    );

    await this.sendEmailVerification(savedUser);

    await this.eventsService.emit('UserRegistered', {
      userId: savedUser.id,
      email: savedUser.email,
    });
    await this.auditService.log({
      action: 'register',
      userId: savedUser.id,
      outcome: 'success',
    });
    return { accessToken, refreshToken };
  }

  async loginWithUser(user: UserEntity, meta?: LoginMetadata): Promise<TokenResponseDto> {
    const session = new SessionEntity();
    session.userId = user.id;
    session.userAgent = meta?.userAgent ?? null;
    const savedSession = await this.sessionRepo.save(session);
    const accessToken = this.tokenService.generateOpaqueToken();
    const refreshToken = this.tokenService.generateOpaqueToken();
    await this.tokenService.storeAccessToken(
      accessToken,
      user.id,
      savedSession.id,
    );
    await this.tokenService.storeRefreshToken(
      refreshToken,
      user.id,
      savedSession.id,
    );

    void this.notificationsService
      .sendToRecipient(
        'email',
        'normal',
        'new-login-alert',
        {
          loginDate: new Date().toUTCString(),
          ipAddress: meta?.ipAddress ?? null,
          userAgent: meta?.userAgent ?? null,
        },
        { email: user.email ?? undefined },
      )
      .catch(() => undefined);

    await this.eventsService.emit('LoginSucceeded', {
      userId: user.id,
      sessionId: savedSession.id,
    });
    await this.auditService.log({
      action: 'login',
      userId: user.id,
      outcome: 'success',
    });
    return { accessToken, refreshToken };
  }

  async login(dto: LoginRequestDto, meta?: LoginMetadata): Promise<TokenResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const cred = await this.credentialRepo.findByUserId(user.id);
    if (!cred) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, cred.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.loginWithUser(user, meta);
  }

  async logout(accessToken: string, sessionId: string, userId?: string): Promise<void> {
    await this.auditService.log({
      action: 'logout',
      userId: userId ?? null,
      outcome: 'success',
    });
    await this.tokenService.revokeAccessToken(accessToken);
    await this.sessionRepo.deleteById(sessionId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) return; // Do not reveal whether email exists
    const token = await this.oneTimeLinkService.create({
      kind: 'password_reset',
      userId: user.id,
    });
    const resetLink = this.oneTimeLinkService.buildUrl('password_reset', token);
    await this.notificationsService.sendToRecipient(
      'email',
      'high',
      'password-reset',
      { resetLink },
      { email: user.email ?? undefined },
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const result = await this.oneTimeLinkService.consume(token, 'email_verification');
    if (!result.userId) {
      throw new UnauthorizedException('Invalid verification link');
    }
    const user = await this.userRepo.findById(result.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.emailVerified = true;
    await this.userRepo.save(user);
    await this.auditService.log({
      action: 'email_verified',
      userId: result.userId,
      outcome: 'success',
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.sessionRepo.deleteByUserId(userId);
    await this.userRepo.delete(userId);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const result = await this.oneTimeLinkService.consume(token, 'password_reset');
    if (!result.userId) {
      throw new UnauthorizedException('Invalid password reset link');
    }
    const userId = result.userId;

    const cred = await this.credentialRepo.findByUserId(userId);
    if (cred) {
      cred.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await this.credentialRepo.save(cred);
    } else {
      const newCred = new CredentialEntity();
      newCred.userId = userId;
      newCred.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await this.credentialRepo.save(newCred);
    }
    await this.sessionRepo.deleteByUserId(userId);
    await this.auditService.log({
      action: 'password_reset_confirm',
      userId,
      outcome: 'success',
    });
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    const payload = await this.tokenService.resolveRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const session = await this.sessionRepo.findById(payload.sessionId);
    if (!session) {
      await this.tokenService.revokeRefreshToken(refreshToken);
      throw new UnauthorizedException('Session no longer valid');
    }
    await this.tokenService.revokeRefreshToken(refreshToken);

    const newAccessToken = this.tokenService.generateOpaqueToken();
    const newRefreshToken = this.tokenService.generateOpaqueToken();
    await this.tokenService.storeAccessToken(
      newAccessToken,
      payload.userId,
      payload.sessionId,
    );
    await this.tokenService.storeRefreshToken(
      newRefreshToken,
      payload.userId,
      payload.sessionId,
    );
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async sendMfaChangeAlert(userId: string, changeDescription: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;
    void this.notificationsService
      .sendToRecipient(
        'email',
        'high',
        'mfa-change',
        {
          changeDescription,
          changeDate: new Date().toUTCString(),
        },
        { email: user.email ?? undefined },
      )
      .catch(() => undefined);
  }

  /**
   * Accept an invitation one-time link. Creates or logs in the user and adds them to the org.
   */
  async acceptInvitation(token: string, password: string): Promise<TokenResponseDto> {
    const result = await this.oneTimeLinkService.consume(token, 'invitation');
    const payload = result.payload ?? {};
    const email = (payload['email'] as string | undefined)?.toLowerCase().trim();
    const organizationId = payload['organizationId'] as string | undefined;
    const roleSlug = (payload['roleSlug'] as string | undefined) ?? 'member';

    if (!email || !organizationId) {
      throw new UnauthorizedException('Invalid invitation payload');
    }

    let user = await this.userRepo.findByEmail(email);
    if (!user) {
      user = new UserEntity();
      user.email = email;
      user.emailVerified = true; // They clicked the invitation link
      user.type = 'human';
      user.organizationId = null;
      user = await this.userRepo.save(user);

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const cred = new CredentialEntity();
      cred.userId = user.id;
      cred.passwordHash = hash;
      await this.credentialRepo.save(cred);

      await this.eventsService.emit('UserRegistered', { userId: user.id, email: user.email });
    }

    // Assign to org with the specified role
    const roles = await this.provisionService.provisionOrgRoles(organizationId);
    const roleToAssign =
      (roles as unknown as Record<string, import('../organization/role.entity').RoleEntity>)[roleSlug]
      ?? roles.member;
    await this.provisionService.assignMember(user.id, organizationId, roleToAssign.id);

    await this.auditService.log({ action: 'invitation_accepted', userId: user.id, outcome: 'success' });
    return this.loginWithUser(user);
  }

  /**
   * Creates a restricted org user (role: end_user) on behalf of a third-party app.
   * The app must authenticate with a service account API key that has an organizationId.
   */
  async createOrgUser(
    organizationId: string,
    email: string,
    password?: string,
    sendInvite?: boolean,
  ): Promise<{ userId: string; email: string; created: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    let user = await this.userRepo.findByEmail(normalizedEmail);
    let created = false;

    if (!user) {
      const newUser = new UserEntity();
      newUser.email = normalizedEmail;
      newUser.emailVerified = false;
      newUser.type = 'human';
      newUser.organizationId = null;
      user = await this.userRepo.save(newUser);
      created = true;

      if (password) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const cred = new CredentialEntity();
        cred.userId = user.id;
        cred.passwordHash = hash;
        await this.credentialRepo.save(cred);
      }

      await this.eventsService.emit('UserRegistered', { userId: user.id, email: user.email });
    }

    // Ensure org roles exist and assign end_user role
    const roles = await this.provisionService.provisionOrgRoles(organizationId);
    await this.provisionService.assignMember(user.id, organizationId, roles.end_user.id);

    if (sendInvite || (created && !password)) {
      await this.requestPasswordReset(normalizedEmail);
    }

    return { userId: user.id, email: normalizedEmail, created };
  }

  private async sendEmailVerification(user: UserEntity): Promise<void> {
    const token = await this.oneTimeLinkService.create({
      kind: 'email_verification',
      userId: user.id,
    });
    const verificationLink = this.oneTimeLinkService.buildUrl('email_verification', token);
    void this.notificationsService
      .sendToRecipient(
        'email',
        'high',
        'email-verification',
        { verificationLink },
        { email: user.email ?? undefined },
      )
      .catch(() => undefined);
  }
}
