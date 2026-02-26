import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { ManagementGuard } from './management.guard';
import { OrganizationRepository } from '../organization/organization.repository';
import { UserOrganizationRepository } from '../organization/user-organization.repository';
import { ResourceRepository } from '../organization/resource.repository';
import { RoleRepository } from '../organization/role.repository';
import { PermissionRepository } from '../organization/permission.repository';
import { UserRepository } from '../user/user.repository';
import { ApiKeyRepository } from '../user/api-key.repository';
import { CredentialRepository } from '../user/credential.repository';
import { ApiKeyService } from '../auth/api-key.service';
import { AllowedRedirectUriRepository } from '../auth/allowed-redirect-uri.repository';
import { RedirectAllowlistService } from '../auth/redirect-allowlist.service';
import { OrganizationProvisionService } from '../organization/organization-provision.service';
import { OneTimeLinkService } from '../one-time-link/one-time-link.service';
import { OrganizationEntity } from '../organization/organization.entity';
import { ResourceEntity } from '../organization/resource.entity';
import { RoleEntity } from '../organization/role.entity';
import { PermissionEntity } from '../organization/permission.entity';
import { UserEntity } from '../user/user.entity';
import { CredentialEntity } from '../user/credential.entity';

const SALT_ROUNDS = 10;

type ReqWithManagement = Request & {
  userId: string;
  managementScope?: 'platform' | 'org';
  allowedOrgIds?: Set<string>;
};

@Controller('management')
@UseGuards(ManagementGuard)
export class ManagementController {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly userOrgRepo: UserOrganizationRepository,
    private readonly resourceRepo: ResourceRepository,
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly userRepo: UserRepository,
    private readonly credentialRepo: CredentialRepository,
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly apiKeyService: ApiKeyService,
    private readonly allowedRedirectUriRepo: AllowedRedirectUriRepository,
    private readonly redirectAllowlistService: RedirectAllowlistService,
    private readonly provisionService: OrganizationProvisionService,
    private readonly oneTimeLinkService: OneTimeLinkService,
  ) {}

  private allowedOrgIds(req: ReqWithManagement): Set<string> | null {
    if (req.managementScope === 'platform') return null;
    return req.allowedOrgIds ?? new Set();
  }

  private async filterOrgs(req: ReqWithManagement): Promise<OrganizationEntity[]> {
    const all = await this.orgRepo.findAll();
    const allowed = this.allowedOrgIds(req);
    if (allowed === null) return all;
    return all.filter((o) => allowed.has(o.id));
  }

  private ensureOrgAccess(req: ReqWithManagement, organizationId: string): void {
    const allowed = this.allowedOrgIds(req);
    if (allowed === null) return;
    if (!allowed.has(organizationId)) {
      throw new ForbiddenException('Access denied to this organization');
    }
  }

  private ensurePlatformAdmin(req: ReqWithManagement): void {
    if (req.managementScope !== 'platform') {
      throw new ForbiddenException('This operation requires platform_admin role');
    }
  }

  // ── Self ─────────────────────────────────────────────────────────────────────

  @Get('me')
  async getCurrentUser(@Req() req: ReqWithManagement) {
    const scope = req.managementScope ?? 'org';
    const allowedOrgIds = req.allowedOrgIds ? Array.from(req.allowedOrgIds) : null;
    return { scope, allowedOrgIds };
  }

  // ── Organizations ───────────────────────────────────────────────────────────

  @Get('organizations')
  async listOrganizations(@Req() req: ReqWithManagement) {
    const organizations = await this.filterOrgs(req);
    return {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        metadata: o.metadata,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  }

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(
    @Req() req: ReqWithManagement,
    @Body()
    body: {
      name: string;
      slug: string;
      metadata?: Record<string, unknown>;
      /** Email of the org admin (new or existing user). Required. */
      adminEmail: string;
      /** Alternatively, provide an existing user's ID to assign as admin. */
      adminUserId?: string;
      /** If adminEmail doesn't exist and createIfMissing is true, a user is created. */
      createIfMissing?: boolean;
      /** Temporary password used when creating a new admin user. */
      adminPassword?: string;
    },
  ) {
    this.ensurePlatformAdmin(req);
    if (!body.adminEmail && !body.adminUserId) {
      throw new BadRequestException('adminEmail or adminUserId is required');
    }

    // 1. Create organization
    const entity = new OrganizationEntity();
    entity.name = body.name;
    entity.slug = body.slug;
    entity.metadata = body.metadata ?? null;
    const saved = await this.orgRepo.save(entity);

    // 2. Provision org roles (org_admin, member, end_user)
    const roles = await this.provisionService.provisionOrgRoles(saved.id);

    // 3. Resolve admin user
    let adminUser: UserEntity | null = null;

    if (body.adminUserId) {
      adminUser = await this.userRepo.findById(body.adminUserId);
      if (!adminUser) throw new NotFoundException(`User with ID ${body.adminUserId} not found`);
    } else if (body.adminEmail) {
      const email = body.adminEmail.toLowerCase().trim();
      adminUser = await this.userRepo.findByEmail(email);

      if (!adminUser) {
        if (body.createIfMissing) {
          const newUser = new UserEntity();
          newUser.email = email;
          newUser.emailVerified = false;
          newUser.type = 'human';
          newUser.organizationId = null;
          adminUser = await this.userRepo.save(newUser);

          if (body.adminPassword) {
            const hash = await bcrypt.hash(body.adminPassword, SALT_ROUNDS);
            const cred = new CredentialEntity();
            cred.userId = adminUser.id;
            cred.passwordHash = hash;
            await this.credentialRepo.save(cred);
          }
        } else {
          throw new NotFoundException(
            `No user found with email ${email}. Set createIfMissing: true to create the user.`,
          );
        }
      }
    }

    // 4. Assign admin
    if (adminUser) {
      await this.provisionService.assignOrgAdmin(adminUser.id, saved.id, roles.org_admin.id);
    }

    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      metadata: saved.metadata,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
      adminUserId: adminUser?.id ?? null,
    };
  }

  @Get('organizations/:organizationId')
  async getOrganization(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
  ) {
    this.ensureOrgAccess(req, organizationId);
    const org = await this.orgRepo.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      metadata: org.metadata,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  @Patch('organizations/:organizationId')
  async updateOrganization(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
    @Body() body: { name?: string; slug?: string; metadata?: Record<string, unknown> },
  ) {
    this.ensureOrgAccess(req, organizationId);
    const org = await this.orgRepo.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    if (body.name != null) org.name = body.name;
    if (body.slug != null) org.slug = body.slug;
    if (body.metadata !== undefined) org.metadata = body.metadata;
    const saved = await this.orgRepo.save(org);
    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      metadata: saved.metadata,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  @Delete('organizations/:organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
  ) {
    this.ensurePlatformAdmin(req);
    const org = await this.orgRepo.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    await this.orgRepo.delete(organizationId);
  }

  @Get('organizations/:organizationId/users')
  async listOrganizationUsers(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
  ) {
    this.ensureOrgAccess(req, organizationId);
    const members = await this.userOrgRepo.findByOrganization(organizationId);
    const users = await Promise.all(
      members.map(async (m) => {
        const user = await this.userRepo.findById(m.userId);
        return {
          userId: m.userId,
          email: user?.email ?? '',
          displayName: user?.displayName ?? null,
          type: user?.type ?? 'human',
          isDefault: m.isDefault,
        };
      }),
    );
    return { users };
  }

  /** Add an existing user (by email) to an organization with an optional role. */
  @Post('organizations/:organizationId/members')
  @HttpCode(HttpStatus.CREATED)
  async addOrganizationMember(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
    @Body() body: { email: string; roleSlug?: string },
  ) {
    this.ensureOrgAccess(req, organizationId);
    if (!body.email) throw new BadRequestException('email is required');

    const org = await this.orgRepo.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    const user = await this.userRepo.findByEmail(body.email.toLowerCase().trim());
    if (!user) {
      throw new NotFoundException(
        'User not found. The user must have an account before being added to an organization.',
      );
    }

    const existingMembership = await this.userOrgRepo.findMembership(user.id, organizationId);
    if (existingMembership && !body.roleSlug) {
      throw new ConflictException('User is already a member of this organization');
    }

    const roleSlug = body.roleSlug ?? 'member';
    const role = await this.roleRepo.findBySlug(roleSlug, organizationId);
    if (!role) {
      throw new NotFoundException(
        `Role '${roleSlug}' not found in this organization. Provision org roles first.`,
      );
    }

    await this.provisionService.assignMember(user.id, organizationId, role.id);

    return {
      userId: user.id,
      email: user.email,
      organizationId,
      roleSlug: role.slug,
    };
  }

  /** Generate a one-time invitation link for a new user to join the organization. */
  @Post('organizations/:organizationId/invitations')
  @HttpCode(HttpStatus.CREATED)
  async inviteToOrganization(
    @Req() req: ReqWithManagement,
    @Param('organizationId') organizationId: string,
    @Body() body: { email: string; roleSlug?: string },
  ) {
    this.ensureOrgAccess(req, organizationId);
    if (!body.email) throw new BadRequestException('email is required');

    const org = await this.orgRepo.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    const roleSlug = body.roleSlug ?? 'member';
    const token = await this.oneTimeLinkService.create({
      kind: 'invitation',
      payload: { email: body.email.toLowerCase().trim(), organizationId, roleSlug },
      ttlSeconds: 7 * 24 * 3600, // 7 days
    });

    const inviteLink = this.oneTimeLinkService.buildUrl('invitation', token);
    return { inviteLink, token, email: body.email, organizationId, roleSlug };
  }

  // ── Users (platform_admin can list all human users) ────────────────────────

  @Get('users')
  async listUsers(
    @Req() req: ReqWithManagement,
  ) {
    this.ensurePlatformAdmin(req);
    // List human users only (service accounts have their own endpoints)
    const users = await this.userRepo.findHumanUsers();
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        type: u.type,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  // ── Resources ───────────────────────────────────────────────────────────────

  @Get('resources')
  async listResources(
    @Req() req: ReqWithManagement,
    @Query('organizationId') organizationId?: string,
  ) {
    let resources: ResourceEntity[];
    if (organizationId) {
      this.ensureOrgAccess(req, organizationId);
      resources = await this.resourceRepo.findByOrganization(organizationId);
    } else {
      const orgs = await this.filterOrgs(req);
      resources = [];
      for (const o of orgs) {
        const list = await this.resourceRepo.findByOrganization(o.id);
        resources.push(...list);
      }
    }
    return {
      resources: resources.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        type: r.type,
        identifier: r.identifier,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  @Post('resources')
  @HttpCode(HttpStatus.CREATED)
  async createResource(
    @Req() req: ReqWithManagement,
    @Body() body: { organizationId: string; type: string; identifier: string },
  ) {
    this.ensureOrgAccess(req, body.organizationId);
    const entity = new ResourceEntity();
    entity.organizationId = body.organizationId;
    entity.type = body.type;
    entity.identifier = body.identifier;
    const saved = await this.resourceRepo.save(entity);
    return {
      id: saved.id,
      organizationId: saved.organizationId,
      type: saved.type,
      identifier: saved.identifier,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  @Get('resources/:resourceId')
  async getResource(
    @Req() req: ReqWithManagement,
    @Param('resourceId') resourceId: string,
  ) {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) throw new NotFoundException('Resource not found');
    this.ensureOrgAccess(req, resource.organizationId);
    return {
      id: resource.id,
      organizationId: resource.organizationId,
      type: resource.type,
      identifier: resource.identifier,
      createdAt: resource.createdAt.toISOString(),
    };
  }

  @Delete('resources/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteResource(
    @Req() req: ReqWithManagement,
    @Param('resourceId') resourceId: string,
  ) {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) throw new NotFoundException('Resource not found');
    this.ensureOrgAccess(req, resource.organizationId);
    await this.resourceRepo.delete(resourceId);
  }

  // ── Roles ───────────────────────────────────────────────────────────────────

  @Get('roles')
  async listRoles(
    @Req() req: ReqWithManagement,
    @Query('organizationId') organizationId?: string,
  ) {
    let roles: RoleEntity[];
    const allowedOrgIds = this.allowedOrgIds(req);
    if (organizationId === undefined || organizationId === '') {
      if (allowedOrgIds === null) {
        // platform_admin: return global roles + all org roles
        roles = await this.roleRepo.findGlobalRoles();
      } else {
        // org_admin: return only their org-scoped roles (no global templates)
        roles = [];
        for (const orgId of allowedOrgIds) {
          const list = await this.roleRepo.findByOrganization(orgId);
          roles = roles.concat(list);
        }
      }
    } else {
      this.ensureOrgAccess(req, organizationId);
      roles = await this.roleRepo.findByOrganization(organizationId);
    }
    return {
      roles: roles.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        slug: r.slug,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  async createRole(
    @Req() req: ReqWithManagement,
    @Body() body: { name: string; slug: string; organizationId?: string | null },
  ) {
    if (body.organizationId) {
      this.ensureOrgAccess(req, body.organizationId);
    } else {
      this.ensurePlatformAdmin(req);
    }
    const entity = new RoleEntity();
    entity.name = body.name;
    entity.slug = body.slug;
    entity.organizationId = body.organizationId ?? null;
    const saved = await this.roleRepo.save(entity);
    return {
      id: saved.id,
      organizationId: saved.organizationId,
      name: saved.name,
      slug: saved.slug,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  @Get('roles/:roleId/permissions')
  async listRolePermissions(
    @Req() req: ReqWithManagement,
    @Param('roleId') roleId: string,
  ) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundException('Role not found');
    if (role.organizationId) this.ensureOrgAccess(req, role.organizationId);
    else this.ensurePlatformAdmin(req);
    const permissions = await this.permissionRepo.findByRole(roleId);
    return {
      permissions: permissions.map((p) => ({
        id: p.id,
        roleId: p.roleId,
        action: p.action,
        resourceIdentifier: p.resourceIdentifier,
      })),
    };
  }

  @Post('roles/:roleId/permissions')
  @HttpCode(HttpStatus.CREATED)
  async addRolePermission(
    @Req() req: ReqWithManagement,
    @Param('roleId') roleId: string,
    @Body() body: { action: string; resourceIdentifier: string },
  ) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundException('Role not found');
    if (role.organizationId) this.ensureOrgAccess(req, role.organizationId);
    else this.ensurePlatformAdmin(req);
    const entity = new PermissionEntity();
    entity.roleId = roleId;
    entity.action = body.action;
    entity.resourceIdentifier = body.resourceIdentifier;
    const saved = await this.permissionRepo.save(entity);
    return {
      id: saved.id,
      roleId: saved.roleId,
      action: saved.action,
      resourceIdentifier: saved.resourceIdentifier,
    };
  }

  // ── Service Accounts ────────────────────────────────────────────────────────

  private serviceAccountView(user: UserEntity) {
    return {
      id: user.id,
      displayName: user.displayName,
      organizationId: user.organizationId,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private ensureServiceAccountAccess(req: ReqWithManagement, account: UserEntity): void {
    if (req.managementScope === 'platform') return;
    const allowed = this.allowedOrgIds(req);
    if (!account.organizationId || !allowed?.has(account.organizationId)) {
      throw new ForbiddenException('Access denied to this service account');
    }
  }

  @Get('service-accounts')
  async listServiceAccounts(
    @Req() req: ReqWithManagement,
    @Query('organizationId') organizationId?: string,
  ) {
    if (req.managementScope === 'platform') {
      const accounts = await this.userRepo.findServiceAccounts(
        organizationId ?? undefined,
      );
      return { serviceAccounts: accounts.map((u) => this.serviceAccountView(u)) };
    }

    // org_admin: only their orgs
    const allowed = this.allowedOrgIds(req);
    if (!allowed || allowed.size === 0) {
      return { serviceAccounts: [] };
    }

    const filterOrgId = organizationId && allowed.has(organizationId) ? organizationId : undefined;
    if (organizationId && !filterOrgId) {
      throw new ForbiddenException('Access denied to this organization');
    }

    let accounts: UserEntity[] = [];
    const orgsToQuery = filterOrgId ? [filterOrgId] : Array.from(allowed);
    for (const orgId of orgsToQuery) {
      const list = await this.userRepo.findServiceAccounts(orgId);
      accounts = accounts.concat(list);
    }
    return { serviceAccounts: accounts.map((u) => this.serviceAccountView(u)) };
  }

  @Post('service-accounts')
  @HttpCode(HttpStatus.CREATED)
  async createServiceAccount(
    @Req() req: ReqWithManagement,
    @Body()
    body: {
      displayName: string;
      description?: string;
      initialKeyName?: string;
      organizationId?: string;
    },
  ) {
    let orgId: string | null = null;

    if (req.managementScope === 'platform') {
      orgId = body.organizationId ?? null;
    } else {
      // org_admin must provide organizationId from their allowed orgs
      if (!body.organizationId) {
        throw new BadRequestException('organizationId is required for org_admin');
      }
      this.ensureOrgAccess(req, body.organizationId);
      orgId = body.organizationId;
    }

    const user = new UserEntity();
    user.type = 'service';
    user.email = null;
    user.displayName = body.displayName;
    user.emailVerified = false;
    user.organizationId = orgId;
    const savedUser = await this.userRepo.save(user);

    const { rawKey, entity: apiKey } = await this.apiKeyService.generateForUser(
      savedUser.id,
      body.initialKeyName ?? 'default',
    );

    return {
      serviceAccount: this.serviceAccountView(savedUser),
      apiKey: {
        id: apiKey.id,
        serviceAccountId: savedUser.id,
        prefix: apiKey.keyPrefix,
        name: apiKey.name,
        rawKey,
        createdAt: apiKey.createdAt.toISOString(),
      },
    };
  }

  @Get('service-accounts/:serviceAccountId')
  async getServiceAccount(
    @Req() req: ReqWithManagement,
    @Param('serviceAccountId') serviceAccountId: string,
  ) {
    const user = await this.userRepo.findById(serviceAccountId);
    if (!user || user.type !== 'service') throw new NotFoundException('Service account not found');
    this.ensureServiceAccountAccess(req, user);
    return this.serviceAccountView(user);
  }

  @Delete('service-accounts/:serviceAccountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteServiceAccount(
    @Req() req: ReqWithManagement,
    @Param('serviceAccountId') serviceAccountId: string,
  ) {
    const user = await this.userRepo.findById(serviceAccountId);
    if (!user || user.type !== 'service') throw new NotFoundException('Service account not found');
    this.ensureServiceAccountAccess(req, user);
    await this.userRepo.delete(serviceAccountId);
  }

  @Get('service-accounts/:serviceAccountId/api-keys')
  async listApiKeys(
    @Req() req: ReqWithManagement,
    @Param('serviceAccountId') serviceAccountId: string,
  ) {
    const user = await this.userRepo.findById(serviceAccountId);
    if (!user || user.type !== 'service') throw new NotFoundException('Service account not found');
    this.ensureServiceAccountAccess(req, user);
    const keys = await this.apiKeyRepo.findByUser(serviceAccountId);
    return {
      apiKeys: keys.map((k) => ({
        id: k.id,
        serviceAccountId: k.userId,
        prefix: k.keyPrefix,
        name: k.name,
        active: k.active,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  }

  @Post('service-accounts/:serviceAccountId/api-keys')
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Req() req: ReqWithManagement,
    @Param('serviceAccountId') serviceAccountId: string,
    @Body() body: { name?: string; expiresAt?: string },
  ) {
    const user = await this.userRepo.findById(serviceAccountId);
    if (!user || user.type !== 'service') throw new NotFoundException('Service account not found');
    this.ensureServiceAccountAccess(req, user);

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const { rawKey, entity: apiKey } = await this.apiKeyService.generateForUser(
      serviceAccountId,
      body.name ?? null,
      expiresAt,
    );

    return {
      id: apiKey.id,
      serviceAccountId,
      prefix: apiKey.keyPrefix,
      name: apiKey.name,
      rawKey,
      createdAt: apiKey.createdAt.toISOString(),
    };
  }

  @Delete('service-accounts/:serviceAccountId/api-keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(
    @Req() req: ReqWithManagement,
    @Param('serviceAccountId') serviceAccountId: string,
    @Param('keyId') keyId: string,
  ) {
    const user = await this.userRepo.findById(serviceAccountId);
    if (!user || user.type !== 'service') throw new NotFoundException('Service account not found');
    this.ensureServiceAccountAccess(req, user);
    const apiKey = await this.apiKeyRepo.findById(keyId);
    if (!apiKey || apiKey.userId !== serviceAccountId) {
      throw new NotFoundException('API key not found');
    }
    await this.apiKeyRepo.revoke(keyId);
  }

  // ── Redirect URIs (platform_admin or org_admin of the org) ──────────────────

  @Get('redirect-uris')
  async listRedirectUris(
    @Req() req: ReqWithManagement,
    @Query('organizationId') organizationId?: string,
  ) {
    let entities;

    if (req.managementScope === 'platform') {
      // Platform admin: return all or filter by org
      if (organizationId) {
        entities = await this.allowedRedirectUriRepo.findByOrg(organizationId);
      } else {
        entities = await this.allowedRedirectUriRepo.findAll();
      }
    } else {
      // Org admin: return only URIs from their allowed orgs
      const allowed = this.allowedOrgIds(req);
      if (!allowed || allowed.size === 0) return { redirectUris: [] };

      if (organizationId) {
        if (!allowed.has(organizationId)) {
          throw new ForbiddenException('Access denied to this organization');
        }
        entities = await this.allowedRedirectUriRepo.findByOrg(organizationId);
      } else {
        entities = await this.allowedRedirectUriRepo.findByOrgs(Array.from(allowed));
      }
    }

    return {
      redirectUris: entities.map((e) => ({
        id: e.id,
        organizationId: e.organizationId,
        uri: e.uri,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  @Post('redirect-uris')
  @HttpCode(HttpStatus.CREATED)
  async addRedirectUri(
    @Req() req: ReqWithManagement,
    @Body() body: { uri?: string; organizationId?: string },
  ) {
    const uri = (body.uri ?? '').trim();
    if (!uri) {
      throw new BadRequestException('uri is required');
    }

    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid scheme');
      }
    } catch {
      throw new BadRequestException('uri must be a non-empty valid URL (http or https).');
    }

    // Resolve target org
    let targetOrgId: string;

    if (req.managementScope === 'platform') {
      if (!body.organizationId) {
        throw new BadRequestException('organizationId is required');
      }
      const org = await this.orgRepo.findById(body.organizationId);
      if (!org) throw new NotFoundException('Organization not found');
      targetOrgId = body.organizationId;
    } else {
      // Org admin must provide their own org
      if (!body.organizationId) {
        throw new BadRequestException('organizationId is required');
      }
      this.ensureOrgAccess(req, body.organizationId);
      targetOrgId = body.organizationId;
    }

    const existing = await this.allowedRedirectUriRepo.findByUriAndOrg(uri, targetOrgId);
    if (existing) {
      throw new ConflictException('This redirect URI is already in the allow list for this organization.');
    }

    const entity = await this.allowedRedirectUriRepo.create(uri, targetOrgId);
    await this.redirectAllowlistService.refresh();

    return {
      id: entity.id,
      organizationId: entity.organizationId,
      uri: entity.uri,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  @Delete('redirect-uris/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRedirectUri(
    @Req() req: ReqWithManagement,
    @Param('id') id: string,
  ) {
    const entity = await this.allowedRedirectUriRepo.findById(id);
    if (!entity) {
      throw new NotFoundException('Redirect URI not found.');
    }

    // Validate org access
    if (req.managementScope !== 'platform') {
      this.ensureOrgAccess(req, entity.organizationId);
    }

    await this.allowedRedirectUriRepo.delete(id);
    await this.redirectAllowlistService.refresh();
  }
}
