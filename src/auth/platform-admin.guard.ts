import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from './token.service';
import { ApiKeyService } from './api-key.service';
import { UserRoleRepository } from '../organization/user-role.repository';

const PLATFORM_ADMIN_SLUG = 'platform_admin';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly apiKeyService: ApiKeyService,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization');
    }
    const token = auth.slice(7);

    if (token.startsWith('spk_')) {
      throw new ForbiddenException('Service accounts cannot access this endpoint');
    }

    const payload = await this.tokenService.resolveAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userRoles = await this.userRoleRepo.findByUser(payload.userId);
    const isPlatformAdmin = userRoles.some(
      (ur) => ur.role?.slug === PLATFORM_ADMIN_SLUG && ur.role?.organizationId == null,
    );
    if (!isPlatformAdmin) {
      throw new ForbiddenException('This endpoint requires platform_admin role');
    }

    (request as Request & { userId: string }).userId = payload.userId;
    return true;
  }
}
