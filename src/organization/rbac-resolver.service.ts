import { Injectable } from '@nestjs/common';
import { ResourceRepository } from './resource.repository';
import { UserRoleRepository } from './user-role.repository';
import { UserOrganizationRepository } from './user-organization.repository';

export interface ResolvedPermission {
  action: string;
  resourceIdentifier: string;
}

/**
 * Resolves user's effective permissions for authorization check.
 * - Loads user's roles (global + org-scoped via UserRole).
 * - Optionally scopes to resource's organization when resource is provided.
 * - Returns flattened list of (action, resourceIdentifier) for matching.
 */
@Injectable()
export class RbacResolverService {
  constructor(
    private readonly userRoleRepo: UserRoleRepository,
    private readonly userOrgRepo: UserOrganizationRepository,
    private readonly resourceRepo: ResourceRepository,
  ) {}

  /**
   * Resolve resource string to organizationId if it is a resource UUID.
   * Returns organizationId or null (for global / unknown resource).
   */
  async resolveResourceOrganizationId(resource: string): Promise<string | null> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resource)) {
      return null;
    }
    const res = await this.resourceRepo.findById(resource);
    return res?.organizationId ?? null;
  }

  /**
   * Normalize resource for permission matching. If resource is a UUID, resolve to "type:identifier"; else return as-is.
   */
  async normalizeResourceForMatching(resource: string): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resource)) {
      return resource;
    }
    const res = await this.resourceRepo.findById(resource);
    if (!res) return resource;
    return `${res.type}:${res.identifier}`;
  }

  /**
   * Get all effective permissions for a user, optionally scoped to resource's organization.
   * - Global roles: always included.
   * - Org-scoped roles: included if user has that role and (no resourceOrgContext, or role.organizationId === resourceOrgContext, or user is member of role's org).
   */
  async resolveUserPermissions(
    userId: string,
    resourceOrgContext: string | null,
  ): Promise<ResolvedPermission[]> {
    const userRoles = await this.userRoleRepo.findByUser(userId);
    const userOrgs = await this.userOrgRepo.findByUser(userId);
    const userOrgIds = new Set(userOrgs.map((uo) => uo.organizationId));

    const permissions: ResolvedPermission[] = [];
    const seen = new Set<string>();

    for (const ur of userRoles) {
      const role = ur.role;
      if (!role?.permissions) continue;

      const roleOrgId = role.organizationId ?? null;
      // Include global roles always.
      if (roleOrgId === null) {
        for (const p of role.permissions) {
          const key = `${p.action}:${p.resourceIdentifier}`;
          if (!seen.has(key)) {
            seen.add(key);
            permissions.push({ action: p.action, resourceIdentifier: p.resourceIdentifier });
          }
        }
        continue;
      }
      // Org-scoped: include if no resource context (all org roles user has), or if role's org matches resource org or user is member of role's org.
      if (
        resourceOrgContext === null ||
        roleOrgId === resourceOrgContext ||
        userOrgIds.has(roleOrgId)
      ) {
        for (const p of role.permissions) {
          const key = `${p.action}:${p.resourceIdentifier}`;
          if (!seen.has(key)) {
            seen.add(key);
            permissions.push({ action: p.action, resourceIdentifier: p.resourceIdentifier });
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Check if user has all requested actions on the resource.
   * Permission matching: exact match on (action, resourceIdentifier) or resourceIdentifier '*' for wildcard.
   */
  async check(
    userId: string,
    actions: string[],
    resource: string,
  ): Promise<boolean> {
    const resourceOrgId = await this.resolveResourceOrganizationId(resource);
    const normalizedResource = await this.normalizeResourceForMatching(resource);
    const permissions = await this.resolveUserPermissions(userId, resourceOrgId);

    for (const action of actions) {
      const hasAction = permissions.some(
        (p) =>
          p.action === action &&
          (p.resourceIdentifier === normalizedResource || p.resourceIdentifier === '*'),
      );
      if (!hasAction) return false;
    }
    return true;
  }
}
