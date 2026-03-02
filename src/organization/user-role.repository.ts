import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleEntity } from './user-role.entity';

@Injectable()
export class UserRoleRepository {
  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly repo: Repository<UserRoleEntity>,
  ) {}

  async save(entity: UserRoleEntity): Promise<UserRoleEntity> {
    return this.repo.save(entity);
  }

  async findByUser(userId: string): Promise<UserRoleEntity[]> {
    return this.repo.find({
      where: { userId },
      relations: ['role', 'role.permissions'],
    });
  }

  async findUserRole(userId: string, roleId: string): Promise<UserRoleEntity | null> {
    return this.repo.findOne({
      where: { userId, roleId },
      relations: ['role', 'role.permissions'],
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.repo.delete({ userId, roleId });
  }

  /** Returns all role assignments for a user in a specific organization. */
  async findByUserAndOrg(userId: string, organizationId: string): Promise<UserRoleEntity[]> {
    const all = await this.repo.find({ where: { userId }, relations: ['role'] });
    return all.filter((ur) => ur.role?.organizationId === organizationId);
  }

  /** Removes all org-scoped role assignments for a user in a specific organization. */
  async deleteByUserAndOrg(userId: string, organizationId: string): Promise<void> {
    const entries = await this.findByUserAndOrg(userId, organizationId);
    for (const entry of entries) {
      await this.repo.delete(entry.id);
    }
  }
}
