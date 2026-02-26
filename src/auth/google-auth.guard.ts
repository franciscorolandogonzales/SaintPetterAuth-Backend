import { ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RedirectAllowlistService } from './redirect-allowlist.service';

/**
 * Custom guard for Google OAuth that optionally passes a `redirect_uri` query
 * parameter as the OAuth `state` so third-party frontends can receive the tokens
 * after the callback.
 *
 * Usage:
 *   GET /auth/google                                  → redirects to FRONTEND_URL after auth
 *   GET /auth/google?redirect_uri=https://app.com/cb  → redirects to https://app.com/cb after auth
 *
 * Security:
 *   - `redirect_uri` is validated against the allow list before being passed to Google.
 *   - The callback handler must re-validate it from `req.query.state` to prevent tampering.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly allowlist: RedirectAllowlistService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const redirectUri = req.query['redirect_uri'];

    if (redirectUri == null || redirectUri === '') {
      return {};
    }

    if (typeof redirectUri !== 'string') {
      throw new BadRequestException('redirect_uri must be a string');
    }

    if (!this.allowlist.isAllowed(redirectUri)) {
      throw new BadRequestException(
        'redirect_uri is not in the list of permitted redirect URIs. Contact the platform administrator.',
      );
    }

    return { state: redirectUri };
  }
}
