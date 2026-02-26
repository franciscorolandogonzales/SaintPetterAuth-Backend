import { Injectable } from '@nestjs/common';
import { AuthorizationCheckRequestDto } from './dto/authorization-check.dto';
import { RbacResolverService } from '../organization/rbac-resolver.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly rbacResolver: RbacResolverService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check whether the caller is authorized to perform actions on a resource.
   *
   * @param userId       - ID of the user (human or service account) making the request.
   * @param body         - Actions to check and the target resource identifier.
   * @param callerOrgId  - Organization ID of the caller when it is a service account (API key).
   *                       Null for human users. When non-null, the resource must belong to this
   *                       organization; otherwise the check returns { allowed: false } immediately.
   */
  async check(
    userId: string,
    body: AuthorizationCheckRequestDto,
    callerOrgId: string | null = null,
  ): Promise<{ allowed: boolean }> {
    if (!body.actions?.length || !body.resource) {
      await this.auditService.log({
        action: 'authorization_check',
        userId,
        resource: body.resource,
        outcome: 'failure',
      });
      return { allowed: false };
    }

    // Service account org-scoping: if the caller is a service account, verify that the
    // resource belongs to the same organization. Cross-org access is always denied.
    if (callerOrgId !== null) {
      const resourceOrgId = await this.rbacResolver.resolveResourceOrganizationId(body.resource);
      if (resourceOrgId !== null && resourceOrgId !== callerOrgId) {
        await this.auditService.log({
          action: 'authorization_check',
          userId,
          resource: body.resource,
          outcome: 'failure',
          metadata: { reason: 'cross_org_denied', callerOrgId, resourceOrgId },
        });
        return { allowed: false };
      }
    }

    const allowed = await this.rbacResolver.check(userId, body.actions, body.resource);
    await this.auditService.log({
      action: 'authorization_check',
      userId,
      resource: body.resource,
      outcome: allowed ? 'success' : 'failure',
      metadata: { actions: body.actions },
    });
    return { allowed };
  }
}
