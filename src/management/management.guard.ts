import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../auth/token.service';
import { ApiKeyService } from '../auth/api-key.service';
import { UserRepository } from '../user/user.repository';
import { UserRoleRepository } from '../organization/user-role.repository';

const PLATFORM_ADMIN_SLUG = 'platform_admin';
const ORG_ADMIN_SLUG = 'org_admin';

@Injectable()
export class ManagementGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly apiKeyService: ApiKeyService,
    private readonly userRepo: UserRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization');
    }
    const token = auth.slice(7);

    // ── Session token (human user) ────────────────────────────────────────────
    const payload = await this.tokenService.resolveAccessToken(token);
    if (payload) {
      return this.authorizeHumanUser(request, payload.userId);
    }

    // ── API key (service account) ─────────────────────────────────────────────
    if (token.startsWith('spk_')) {
      const apiKey = await this.apiKeyService.findAndValidate(token);
      if (!apiKey) {
        throw new UnauthorizedException('Invalid or expired API key');
      }
      return this.authorizeServiceAccount(request, apiKey.userId);
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  /**
   * Human users are authorized via their roles (platform_admin / org_admin).
   */
  private async authorizeHumanUser(request: Request, userId: string): Promise<boolean> {
    (request as Request & { userId: string }).userId = userId;

    const userRoles = await this.userRoleRepo.findByUser(userId);
    const isPlatformAdmin = userRoles.some(
      (ur) => ur.role?.slug === PLATFORM_ADMIN_SLUG && ur.role?.organizationId == null,
    );
    if (isPlatformAdmin) {
      (request as Request & { userId: string; managementScope: 'platform' }).managementScope = 'platform';
      return true;
    }

    const orgAdminRoles = userRoles.filter(
      (ur) => ur.role?.slug === ORG_ADMIN_SLUG && ur.role?.organizationId != null,
    );
    const adminOrgIds = new Set(orgAdminRoles.map((ur) => ur.role!.organizationId!));
    if (adminOrgIds.size === 0) {
      throw new ForbiddenException('Management access requires platform_admin or org_admin role');
    }

    (request as Request & { userId: string; managementScope: 'org'; allowedOrgIds: Set<string> }).managementScope = 'org';
    (request as Request & { userId: string; managementScope: string; allowedOrgIds: Set<string> }).allowedOrgIds = adminOrgIds;
    return true;
  }

  /**
   * Service accounts are scoped strictly to their own organization.
   * They do not have roles in user_roles; access is determined solely
   * by UserEntity.organizationId.
   */
  private async authorizeServiceAccount(request: Request, userId: string): Promise<boolean> {
    const serviceAccount = await this.userRepo.findById(userId);
    if (!serviceAccount || serviceAccount.type !== 'service') {
      throw new UnauthorizedException('Invalid service account');
    }
    if (!serviceAccount.organizationId) {
      throw new ForbiddenException('Service account is not associated with any organization');
    }

    const req = request as Request & {
      userId: string;
      managementScope: 'org';
      allowedOrgIds: Set<string>;
    };
    req.userId = userId;
    req.managementScope = 'org';
    req.allowedOrgIds = new Set([serviceAccount.organizationId]);
    return true;
  }
}
