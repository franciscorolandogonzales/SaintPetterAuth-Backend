import { Injectable, Logger } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { ResourceRepository } from './resource.repository';
import { UserOrganizationRepository } from './user-organization.repository';
import { UserRoleRepository } from './user-role.repository';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';
import { ResourceEntity } from './resource.entity';
import { UserOrganizationEntity } from './user-organization.entity';
import { UserRoleEntity } from './user-role.entity';
import { ORG_ROLE_TEMPLATES } from './org-role-definitions';

export interface OrgRolesMap {
  org_admin: RoleEntity;
  member: RoleEntity;
  end_user: RoleEntity;
}

@Injectable()
export class OrganizationProvisionService {
  private readonly logger = new Logger(OrganizationProvisionService.name);

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly resourceRepo: ResourceRepository,
    private readonly userOrgRepo: UserOrganizationRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  /** Creates org-scoped roles (org_admin, member, end_user) with their permissions.
   *  Idempotent: skips already-existing roles. */
  async provisionOrgRoles(organizationId: string): Promise<OrgRolesMap> {
    const map: Partial<OrgRolesMap> = {};

    for (const template of ORG_ROLE_TEMPLATES) {
      let role = await this.roleRepo.findBySlug(template.slug, organizationId);
      if (!role) {
        const entity = new RoleEntity();
        entity.name = template.name;
        entity.slug = template.slug;
        entity.organizationId = organizationId;
        role = await this.roleRepo.save(entity);
        this.logger.log(`Created role ${template.slug} for org ${organizationId}`);
      }

      const existing = await this.permissionRepo.findByRole(role.id);
      const existingKeys = new Set(existing.map((p) => `${p.action}:${p.resourceIdentifier}`));

      for (const p of template.permissions) {
        const key = `${p.action}:${p.resourceIdentifier}`;
        if (existingKeys.has(key)) continue;
        const entity = new PermissionEntity();
        entity.roleId = role.id;
        entity.action = p.action;
        entity.resourceIdentifier = p.resourceIdentifier;
        await this.permissionRepo.save(entity);
      }

      (map as Record<string, RoleEntity>)[template.slug] = role;
    }

    await this.provisionOrgResources(organizationId);

    return map as OrgRolesMap;
  }

  /**
   * Creates the per-org resources that must exist so they appear in the Resources list
   * and can be referenced by `POST /authorization/check`.
   * Idempotent: skips already-existing resources.
   */
  private async provisionOrgResources(organizationId: string): Promise<void> {
    const orgResources: { type: string; identifier: string }[] = [
      { type: 'auth', identifier: 'redirect_uri' },
    ];

    for (const def of orgResources) {
      const existing = await this.resourceRepo.findByOrgAndTypeAndIdentifier(
        organizationId,
        def.type,
        def.identifier,
      );
      if (existing) continue;

      const entity = new ResourceEntity();
      entity.organizationId = organizationId;
      entity.type = def.type;
      entity.identifier = def.identifier;
      await this.resourceRepo.save(entity);
      this.logger.log(`Created resource ${def.type}:${def.identifier} for org ${organizationId}`);
    }
  }

  /** Assigns a user as org_admin of the given organization. Idempotent. */
  async assignOrgAdmin(userId: string, organizationId: string, orgAdminRoleId: string): Promise<void> {
    const existing = await this.userOrgRepo.findMembership(userId, organizationId);
    if (!existing) {
      const uo = new UserOrganizationEntity();
      uo.userId = userId;
      uo.organizationId = organizationId;
      uo.isDefault = false;
      await this.userOrgRepo.save(uo);
    }

    const existingRole = await this.userRoleRepo.findUserRole(userId, orgAdminRoleId);
    if (!existingRole) {
      const ur = new UserRoleEntity();
      ur.userId = userId;
      ur.roleId = orgAdminRoleId;
      await this.userRoleRepo.save(ur);
    }
  }

  /** Assigns a user as a member of the given organization with the given role. Idempotent. */
  async assignMember(userId: string, organizationId: string, roleId: string): Promise<void> {
    const existing = await this.userOrgRepo.findMembership(userId, organizationId);
    if (!existing) {
      const uo = new UserOrganizationEntity();
      uo.userId = userId;
      uo.organizationId = organizationId;
      uo.isDefault = false;
      await this.userOrgRepo.save(uo);
    }

    const existingRole = await this.userRoleRepo.findUserRole(userId, roleId);
    if (!existingRole) {
      const ur = new UserRoleEntity();
      ur.userId = userId;
      ur.roleId = roleId;
      await this.userRoleRepo.save(ur);
    }
  }
}
