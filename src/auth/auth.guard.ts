import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from './token.service';
import { ApiKeyService } from './api-key.service';
import { UserRepository } from '../user/user.repository';

type AuthenticatedRequest = Request & {
  userId: string;
  sessionId?: string;
  accessToken?: string;
  /** Populated only for service account API keys; null for human session tokens. */
  organizationId?: string | null;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly apiKeyService: ApiKeyService,
    private readonly userRepo: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization');
    }
    const token = auth.slice(7);

    // Attempt 1: opaque session token (human user, Redis lookup)
    const payload = await this.tokenService.resolveAccessToken(token);
    if (payload) {
      const req = request as AuthenticatedRequest;
      req.userId = payload.userId;
      req.sessionId = payload.sessionId;
      req.accessToken = token;
      req.organizationId = null; // human users have no fixed org on the token
      return true;
    }

    // Attempt 2: service account API key (spk_ prefix → DB lookup)
    if (token.startsWith('spk_')) {
      const apiKey = await this.apiKeyService.findAndValidate(token);
      if (apiKey) {
        const serviceAccount = await this.userRepo.findById(apiKey.userId);
        const req = request as AuthenticatedRequest;
        req.userId = apiKey.userId;
        req.accessToken = token;
        // Propagate the service account's org so downstream handlers can enforce scoping
        req.organizationId = serviceAccount?.organizationId ?? null;
        return true;
      }
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
