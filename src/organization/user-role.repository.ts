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
}
