import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OrganizationRepository } from '../organization/organization.repository';
import { ResourceRepository } from '../organization/resource.repository';
import { RoleRepository } from '../organization/role.repository';
import { PermissionRepository } from '../organization/permission.repository';
import { UserRoleRepository } from '../organization/user-role.repository';
import { UserRepository } from '../user/user.repository';
import { OrganizationEntity } from '../organization/organization.entity';
import { ResourceEntity } from '../organization/resource.entity';
import { RoleEntity } from '../organization/role.entity';
import { PermissionEntity } from '../organization/permission.entity';
import { UserRoleEntity } from '../organization/user-role.entity';
import {
  ORG_ADMIN_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '../organization/org-role-definitions';

const SYSTEM_ORG_SLUG = 'system';

const DEFAULT_ROLES: { slug: string; name: string }[] = [
  { slug: 'platform_admin', name: 'Platform Admin' },
  { slug: 'org_admin', name: 'Org Admin' },
  { slug: 'member', name: 'Member' },
];

const SYSTEM_RESOURCES = ['organization', 'user', 'resource', 'role', 'permission', 'service_account', 'mfa', 'password', 'redirect_uri'];

const PLATFORM_ADMIN_PERMISSIONS: { action: string; resourceIdentifier: string }[] = [
  ...SYSTEM_RESOURCES.flatMap((r) =>
    ['create', 'read', 'update', 'delete'].map((a) => ({ action: a, resourceIdentifier: `auth:${r}` })),
  ),
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly resourceRepo: ResourceRepository,
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running bootstrap seed...');
    const systemOrg = await this.ensureSystemOrganization();
    await this.ensureSystemResources(systemOrg.id);
    const rolesMap = await this.ensureDefaultRoles();
    await this.ensurePermissions(rolesMap);
    const platformAdminStatus = await this.ensurePlatformAdmin();
    this.logger.log(`Platform admin: ${platformAdminStatus}`);
    this.logger.log('Bootstrap seed complete.');
  }

  /** If SPA_PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_EMAIL is set, assign platform_admin role to that user (by email). Returns a short status message for logs. */
  private async ensurePlatformAdmin(): Promise<string> {
    const email = (process.env.SPA_PLATFORM_ADMIN_EMAIL ?? process.env.PLATFORM_ADMIN_EMAIL)?.trim();
    if (!email) {
      return 'SPA_PLATFORM_ADMIN_EMAIL not set. Set it in containers/.env and recreate the backend to assign the role.';
    }

    const platformAdminRole = await this.roleRepo.findBySlug('platform_admin', null);
    if (!platformAdminRole) {
      return 'platform_admin role not found (seed order issue?).';
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return `user not found for email ${email}. Sign in once (register or Google), then run restart-backend.sh or down/up.`;
    }

    const existing = await this.userRoleRepo.findUserRole(user.id, platformAdminRole.id);
    if (existing) {
      return `already assigned to ${email}.`;
    }

    const ur = new UserRoleEntity();
    ur.userId = user.id;
    ur.roleId = platformAdminRole.id;
    await this.userRoleRepo.save(ur);
    return `assigned to ${email} (userId=${user.id}).`;
  }

  private async ensureSystemOrganization(): Promise<OrganizationEntity> {
    const existing = await this.orgRepo.findBySlug(SYSTEM_ORG_SLUG);
    if (existing) {
      this.logger.log('System organization: ok (existing).');
      return existing;
    }
    const org = new OrganizationEntity();
    org.name = 'System';
    org.slug = SYSTEM_ORG_SLUG;
    org.metadata = { system: true };
    const saved = await this.orgRepo.save(org);
    this.logger.log(`System organization: created (${saved.id}).`);
    return saved;
  }

  private async ensureSystemResources(systemOrgId: string): Promise<void> {
    let created = 0;
    for (const identifier of SYSTEM_RESOURCES) {
      const existing = await this.resourceRepo.findByOrgAndTypeAndIdentifier(
        systemOrgId,
        'auth',
        identifier,
      );
      if (existing) continue;
      const entity = new ResourceEntity();
      entity.organizationId = systemOrgId;
      entity.type = 'auth';
      entity.identifier = identifier;
      await this.resourceRepo.save(entity);
      created++;
    }
    this.logger.log(`System resources: ok (${created} created, ${SYSTEM_RESOURCES.length - created} existing).`);
  }

  private async ensureDefaultRoles(): Promise<Map<string, RoleEntity>> {
    const map = new Map<string, RoleEntity>();
    let created = 0;
    for (const def of DEFAULT_ROLES) {
      let role = await this.roleRepo.findBySlug(def.slug, null);
      if (!role) {
        const entity = new RoleEntity();
        entity.name = def.name;
        entity.slug = def.slug;
        entity.organizationId = null;
        role = await this.roleRepo.save(entity);
        created++;
      }
      map.set(def.slug, role);
    }
    this.logger.log(`Default roles: ok (${created} created, ${DEFAULT_ROLES.length - created} existing).`);
    return map;
  }

  private async ensurePermissions(
    rolesMap: Map<string, RoleEntity>,
  ): Promise<void> {
    const permDefs: [string, { action: string; resourceIdentifier: string }[]][] = [
      ['platform_admin', PLATFORM_ADMIN_PERMISSIONS],
      ['org_admin', ORG_ADMIN_PERMISSIONS],
      ['member', MEMBER_PERMISSIONS],
    ];
    let created = 0;
    for (const [slug, perms] of permDefs) {
      const role = rolesMap.get(slug);
      if (!role) continue;
      const existing = await this.permissionRepo.findByRole(role.id);
      const existingKeys = new Set(existing.map((p) => `${p.action}:${p.resourceIdentifier}`));
      for (const p of perms) {
        const key = `${p.action}:${p.resourceIdentifier}`;
        if (existingKeys.has(key)) continue;
        const entity = new PermissionEntity();
        entity.roleId = role.id;
        entity.action = p.action;
        entity.resourceIdentifier = p.resourceIdentifier;
        await this.permissionRepo.save(entity);
        created++;
      }
    }
    this.logger.log(`Permissions: ok (${created} created, rest existing).`);
  }
}
