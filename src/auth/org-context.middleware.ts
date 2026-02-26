import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from './api-key.service';
import { UserRepository } from '../user/user.repository';

export type RequestWithOrgContext = Request & {
  orgContextId?: string;
};

/**
 * Reads the optional `X-Org-Api-Key` header. If present and valid, attaches the
 * service account's `organizationId` to `req.orgContextId` so that downstream
 * handlers (login, register, authorization check) know which organisation the
 * third-party application belongs to.
 *
 * This middleware is non-blocking: if the header is absent or the key is invalid
 * the request continues without an org context.
 */
@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly userRepo: UserRepository,
  ) {}

  async use(req: RequestWithOrgContext, _res: Response, next: NextFunction): Promise<void> {
    const rawKey = req.headers['x-org-api-key'] as string | undefined;
    if (rawKey) {
      const apiKey = await this.apiKeyService.findAndValidate(rawKey).catch(() => null);
      if (apiKey) {
        const serviceAccount = await this.userRepo.findById(apiKey.userId).catch(() => null);
        if (serviceAccount?.type === 'service' && serviceAccount.organizationId) {
          req.orgContextId = serviceAccount.organizationId;
        }
      }
    }
    next();
  }
}
