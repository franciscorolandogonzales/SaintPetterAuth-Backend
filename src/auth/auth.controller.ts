import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RegisterRequestDto } from './dto/register.dto';
import { LoginRequestDto } from './dto/login.dto';
import { RefreshRequestDto } from './dto/refresh.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { PasswordResetRequestDto, PasswordResetConfirmDto } from './dto/password-reset.dto';
import { MfaTotpVerifyRequestDto } from './dto/mfa.dto';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { OneTimeLinkService } from '../one-time-link/one-time-link.service';
import { AuthGuard as BearerAuthGuard } from './auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { RedirectAllowlistService } from './redirect-allowlist.service';
import { UserEntity } from '../user/user.entity';

type ReqWithAuth = Request & {
  userId?: string;
  sessionId?: string;
  accessToken?: string;
  orgContextId?: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly oneTimeLinkService: OneTimeLinkService,
    private readonly allowlist: RedirectAllowlistService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterRequestDto): Promise<TokenResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginRequestDto, @Req() req: Request): Promise<TokenResponseDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(body, { ipAddress, userAgent });
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshRequestDto): Promise<TokenResponseDto> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async passwordResetRequest(@Body() body: PasswordResetRequestDto): Promise<void> {
    await this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async passwordResetConfirm(@Body() body: PasswordResetConfirmDto): Promise<void> {
    await this.authService.confirmPasswordReset(body.token, body.newPassword);
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Query('token') token: string): Promise<void> {
    await this.authService.verifyEmail(token);
  }

  /**
   * Initiates the Google OAuth 2.0 login flow.
   *
   * @param redirect_uri  Optional. If provided, the backend will redirect the user
   *                      to this URL after successful Google authentication, instead
   *                      of the default FRONTEND_URL. Must be in GOOGLE_ALLOWED_REDIRECT_URIS.
   *                      The tokens are passed in the URL fragment: #access_token=...&refresh_token=...
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(): Promise<void> {}

  /**
   * Google OAuth 2.0 callback.
   *
   * Reads the `state` query param (set by GoogleAuthGuard as the original `redirect_uri`)
   * and re-validates it against the allow list before redirecting.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user?: UserEntity },
    @Res() res: Response,
  ): Promise<void> {
    // Re-validate state from Google's callback to prevent open redirect.
    const stateParam = req.query['state'];
    const customRedirectUri =
      typeof stateParam === 'string' && stateParam.length > 0 && this.allowlist.isAllowed(stateParam)
        ? stateParam
        : null;

    const defaultUrl = this.allowlist.getDefaultUrl();

    const user = req.user;
    if (!user) {
      const errorBase = customRedirectUri ?? `${defaultUrl}/login`;
      const separator = errorBase.includes('?') ? '&' : '?';
      res.redirect(`${errorBase}${separator}error=google_failed`);
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const tokens = await this.authService.loginWithUser(user, { ipAddress, userAgent });

    const callbackBase = customRedirectUri ?? `${defaultUrl}/auth/callback`;
    res.redirect(
      `${callbackBase}#access_token=${encodeURIComponent(tokens.accessToken)}&refresh_token=${encodeURIComponent(tokens.refreshToken)}`,
    );
  }

  @Post('mfa/totp/enroll')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(BearerAuthGuard)
  async mfaTotpEnroll(@Req() req: ReqWithAuth): Promise<{ secret: string; qrDataUrl: string }> {
    const userId = req.userId ?? '';
    const result = await this.mfaService.enrollTotp(userId);
    void this.authService.sendMfaChangeAlert(userId, 'TOTP authenticator enrolled');
    return result;
  }

  @Post('mfa/totp/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BearerAuthGuard)
  async mfaTotpVerify(
    @Req() req: ReqWithAuth,
    @Body() body: MfaTotpVerifyRequestDto,
  ): Promise<{ valid: boolean }> {
    const userId = req.userId ?? '';
    const valid = await this.mfaService.verifyTotp(userId, body.code);
    return { valid };
  }

  @Get('mfa/methods')
  @UseGuards(BearerAuthGuard)
  async mfaListMethods(@Req() req: ReqWithAuth): Promise<{ methods: { type: string; id: string }[] }> {
    const userId = req.userId ?? '';
    const methods = await this.mfaService.listMethods(userId);
    return { methods };
  }

  @Post('mfa/totp/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BearerAuthGuard)
  async mfaTotpRemove(@Req() req: ReqWithAuth): Promise<void> {
    const userId = req.userId ?? '';
    await this.mfaService.removeTotp(userId);
    void this.authService.sendMfaChangeAlert(userId, 'TOTP authenticator removed');
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BearerAuthGuard)
  async deleteAccount(@Req() req: ReqWithAuth): Promise<void> {
    const userId = req.userId ?? '';
    await this.authService.deleteAccount(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BearerAuthGuard)
  async logout(@Req() req: ReqWithAuth): Promise<void> {
    const accessToken = req.accessToken ?? '';
    const sessionId = req.sessionId ?? '';
    const userId = req.userId;
    await this.authService.logout(accessToken, sessionId, userId);
  }

  /**
   * Third-party apps can call this endpoint (authenticated via `X-Org-Api-Key`)
   * to add a new end_user to their organization. The user gets a restricted profile
   * that only allows MFA setup and password change.
   */
  @Post('app/users')
  @HttpCode(HttpStatus.CREATED)
  async createAppUser(
    @Req() req: ReqWithAuth,
    @Body() body: { email: string; password?: string; sendInvite?: boolean },
  ) {
    const orgContextId = req.orgContextId;
    if (!orgContextId) {
      throw new UnauthorizedException('X-Org-Api-Key header with a valid service account key is required');
    }
    const result = await this.authService.createOrgUser(
      orgContextId,
      body.email,
      body.password,
      body.sendInvite,
    );
    return result;
  }

  /** Validate an invitation token (without consuming) and return invite details. */
  @Get('invite/accept')
  @HttpCode(HttpStatus.OK)
  async getInviteDetails(@Query('token') token: string) {
    const link = await this.oneTimeLinkService.peek(token, 'invitation');
    return {
      valid: true,
      email: link.payload?.email,
      organizationId: link.payload?.organizationId,
      roleSlug: link.payload?.roleSlug,
    };
  }

  /** Accept an invitation: register (or login) and join the organization. */
  @Post('invite/accept')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(
    @Body() body: { token: string; password: string },
  ): Promise<TokenResponseDto> {
    return this.authService.acceptInvitation(body.token, body.password);
  }
}
