import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from './permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repo: Repository<PermissionEntity>,
  ) {}

  async save(entity: PermissionEntity): Promise<PermissionEntity> {
    return this.repo.save(entity);
  }

  async findByRole(roleId: string): Promise<PermissionEntity[]> {
    return this.repo.find({ where: { roleId }, order: { action: 'ASC' } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async deleteByRole(roleId: string): Promise<void> {
    await this.repo.delete({ roleId });
  }
}
