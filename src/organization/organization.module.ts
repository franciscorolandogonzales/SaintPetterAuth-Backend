import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserOrganizationEntity } from './user-organization.entity';
import { ResourceEntity } from './resource.entity';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';
import { UserRoleEntity } from './user-role.entity';
import { OrganizationRepository } from './organization.repository';
import { UserOrganizationRepository } from './user-organization.repository';
import { ResourceRepository } from './resource.repository';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { UserRoleRepository } from './user-role.repository';
import { RbacResolverService } from './rbac-resolver.service';
import { OrganizationProvisionService } from './organization-provision.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      UserOrganizationEntity,
      ResourceEntity,
      RoleEntity,
      PermissionEntity,
      UserRoleEntity,
    ]),
  ],
  providers: [
    OrganizationRepository,
    UserOrganizationRepository,
    ResourceRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    RbacResolverService,
    OrganizationProvisionService,
  ],
  exports: [
    TypeOrmModule,
    OrganizationRepository,
    UserOrganizationRepository,
    ResourceRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    RbacResolverService,
    OrganizationProvisionService,
  ],
})
export class OrganizationModule {}
