import { ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RedirectAllowlistService } from './redirect-allowlist.service';

/** Allowed values for response_mode: fragment (default) or query (for backend callbacks). */
export type ResponseMode = 'fragment' | 'query';

/**
 * Encodes state payload for OAuth so the callback can distinguish redirect_uri + response_mode.
 * Uses base64url(JSON) so it survives the round-trip; plain redirect_uri is still used when
 * response_mode is not 'query' for backward compatibility.
 */
function encodeState(redirectUri: string, responseMode: ResponseMode): string {
  if (responseMode === 'fragment') {
    return redirectUri;
  }
  const payload = JSON.stringify({ r: redirectUri, m: 'query' });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decodes state from the callback. Returns { redirectUri, responseMode }.
 * If state is plain URL (legacy or fragment mode), responseMode is 'fragment'.
 */
export function decodeState(stateParam: string | undefined): { redirectUri: string | null; responseMode: ResponseMode } {
  if (typeof stateParam !== 'string' || stateParam.length === 0) {
    return { redirectUri: null, responseMode: 'fragment' };
  }
  try {
    const decoded = Buffer.from(stateParam, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { r?: string; m?: string };
    if (typeof parsed?.r === 'string' && parsed.m === 'query') {
      return { redirectUri: parsed.r, responseMode: 'query' };
    }
  } catch {
    // not base64json or invalid — treat as plain redirect_uri (legacy)
  }
  return { redirectUri: stateParam, responseMode: 'fragment' };
}

/**
 * Custom guard for Google OAuth that optionally passes a `redirect_uri` query
 * parameter as the OAuth `state` so third-party frontends can receive the tokens
 * after the callback.
 *
 * Optional `response_mode`: `fragment` (default) or `query`. Use `query` when the
 * redirect_uri is a backend endpoint that must receive tokens in the query string
 * (fragment is not sent to the server in HTTP).
 *
 * Usage:
 *   GET /auth/google                                  → redirects to FRONTEND_URL, tokens in fragment
 *   GET /auth/google?redirect_uri=https://app.com/cb  → redirects to URL, tokens in fragment
 *   GET /auth/google?redirect_uri=https://api.com/cb&response_mode=query → tokens in query (backend callback)
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
    const responseModeRaw = req.query['response_mode'];

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

    const responseMode: ResponseMode =
      responseModeRaw === 'query' ? 'query' : 'fragment';

    const state = encodeState(redirectUri, responseMode);
    return { state };
  }
}
