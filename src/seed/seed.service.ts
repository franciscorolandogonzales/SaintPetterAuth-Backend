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
    await this.ensurePlatformAdmin();
    this.logger.log('Bootstrap seed complete.');
  }

  /** If PLATFORM_ADMIN_EMAIL is set, assign platform_admin role to that user (by email). */
  private async ensurePlatformAdmin(): Promise<void> {
    const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
    if (!email) return;

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      this.logger.warn(`PLATFORM_ADMIN_EMAIL=${email}: user not found. Sign in once with this email, then restart the backend.`);
      return;
    }

    const platformAdminRole = await this.roleRepo.findBySlug('platform_admin', null);
    if (!platformAdminRole) {
      this.logger.warn('platform_admin role not found (seed order issue?).');
      return;
    }

    const existing = await this.userRoleRepo.findUserRole(user.id, platformAdminRole.id);
    if (existing) return;

    const ur = new UserRoleEntity();
    ur.userId = user.id;
    ur.roleId = platformAdminRole.id;
    await this.userRoleRepo.save(ur);
    this.logger.log(`Assigned platform_admin role to ${email}.`);
  }

  private async ensureSystemOrganization(): Promise<OrganizationEntity> {
    const existing = await this.orgRepo.findBySlug(SYSTEM_ORG_SLUG);
    if (existing) return existing;

    const org = new OrganizationEntity();
    org.name = 'System';
    org.slug = SYSTEM_ORG_SLUG;
    org.metadata = { system: true };
    const saved = await this.orgRepo.save(org);
    this.logger.log(`Created system organization: ${saved.id}`);
    return saved;
  }

  private async ensureSystemResources(systemOrgId: string): Promise<void> {
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
      this.logger.log(`Created system resource: auth:${identifier}`);
    }
  }

  private async ensureDefaultRoles(): Promise<Map<string, RoleEntity>> {
    const map = new Map<string, RoleEntity>();
    for (const def of DEFAULT_ROLES) {
      let role = await this.roleRepo.findBySlug(def.slug, null);
      if (!role) {
        const entity = new RoleEntity();
        entity.name = def.name;
        entity.slug = def.slug;
        entity.organizationId = null;
        role = await this.roleRepo.save(entity);
        this.logger.log(`Created default role: ${def.slug} (${role.id})`);
      }
      map.set(def.slug, role);
    }
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
        this.logger.log(`Created permission: ${slug} -> ${key}`);
      }
    }
  }
}
